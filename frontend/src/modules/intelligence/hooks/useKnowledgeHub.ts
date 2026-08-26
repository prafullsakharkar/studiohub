import { useState, useEffect, useCallback } from 'react';
import {
  KnowledgeDocument,
  KnowledgeCategory,
  KnowledgeEntityRelationship,
} from '@/types/intelligence';
import { knowledgeService } from '../services/KnowledgeService';

export function useKnowledgeHub(initialCategory?: string) {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory || 'ALL');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('ALL');
  const [selectedProject, setSelectedProject] = useState<string>('ALL');
  const [selectedTag, setSelectedTag] = useState<string | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeDoc, setActiveDoc] = useState<KnowledgeDocument | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await knowledgeService.getDocuments({
        category: selectedCategory,
        department: selectedDepartment,
        projectCode: selectedProject,
        tag: selectedTag,
        search: searchQuery,
      });
      setDocuments(data);
      if (data.length > 0 && !activeDoc) {
        setActiveDoc(data[0]);
      }
    } catch (err) {
      console.error('Failed to load knowledge documents:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, selectedDepartment, selectedProject, selectedTag, searchQuery, activeDoc]);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  const selectDoc = async (id: string) => {
    const doc = await knowledgeService.getDocument(id);
    if (doc) {
      setActiveDoc(doc);
    }
  };

  const createDoc = async (
    docData: Omit<KnowledgeDocument, 'id' | 'created_at' | 'updated_at' | 'views_count' | 'likes_count'>
  ) => {
    const newDoc = await knowledgeService.createDocument(docData);
    setDocuments((prev) => [newDoc, ...prev]);
    setActiveDoc(newDoc);
    return newDoc;
  };

  const updateDoc = async (id: string, updates: Partial<KnowledgeDocument>) => {
    const updated = await knowledgeService.updateDocument(id, updates);
    setDocuments((prev) => prev.map((d) => (d.id === id ? updated : d)));
    if (activeDoc?.id === id) {
      setActiveDoc(updated);
    }
    return updated;
  };

  const deleteDoc = async (id: string) => {
    await knowledgeService.deleteDocument(id);
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    if (activeDoc?.id === id) {
      setActiveDoc(documents.find((d) => d.id !== id) || null);
    }
  };

  const linkEntity = async (docId: string, link: Omit<KnowledgeEntityRelationship, 'id'>) => {
    const updated = await knowledgeService.linkEntity(docId, link);
    setDocuments((prev) => prev.map((d) => (d.id === docId ? updated : d)));
    if (activeDoc?.id === docId) {
      setActiveDoc(updated);
    }
  };

  const unlinkEntity = async (docId: string, linkId: string) => {
    const updated = await knowledgeService.unlinkEntity(docId, linkId);
    setDocuments((prev) => prev.map((d) => (d.id === docId ? updated : d)));
    if (activeDoc?.id === docId) {
      setActiveDoc(updated);
    }
  };

  return {
    documents,
    activeDoc,
    selectedCategory,
    setSelectedCategory,
    selectedDepartment,
    setSelectedDepartment,
    selectedProject,
    setSelectedProject,
    selectedTag,
    setSelectedTag,
    searchQuery,
    setSearchQuery,
    loading,
    selectDoc,
    createDoc,
    updateDoc,
    deleteDoc,
    linkEntity,
    unlinkEntity,
    refresh: fetchDocs,
  };
}
