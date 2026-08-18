# storage.py
"""
Storage service for file operations.
"""
from typing import BinaryIO, Optional
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile


class StorageService:
    """
    Service for managing file storage operations.
    
    Provides a unified interface for file operations including:
    - File upload and storage
    - File retrieval
    - File deletion
    - File URL generation
    """
    
    @staticmethod
    def save_file(
        name: str,
        content: bytes,
        directory: str = "",
        organization_id: Optional[str] = None
    ) -> str:
        """
        Save a file to storage.
        
        Args:
            name: Original filename
            content: File content as bytes
            directory: Directory path within storage
            organization_id: Optional organization ID for path organization
            
        Returns:
            Path to saved file
        """
        # Build full path
        if organization_id and directory:
            full_path = f"{directory}/{organization_id}/{name}"
        elif directory:
            full_path = f"{directory}/{name}"
        else:
            full_path = name
        
        # Save file using Django's default storage
        default_storage.save(full_path, ContentFile(content))
        return full_path
    
    @staticmethod
    def save_file_from_file_object(
        name: str,
        file_object: BinaryIO,
        directory: str = "",
        organization_id: Optional[str] = None
    ) -> str:
        """
        Save a file from a file object.
        
        Args:
            name: Original filename
            file_object: File-like object to read from
            directory: Directory path within storage
            organization_id: Optional organization ID for path organization
            
        Returns:
            Path to saved file
        """
        # Build full path
        if organization_id and directory:
            full_path = f"{directory}/{organization_id}/{name}"
        elif directory:
            full_path = f"{directory}/{name}"
        else:
            full_path = name
        
        # Save file using Django's default storage
        default_storage.save(full_path, ContentFile(file_object.read()))
        return full_path
    
    @staticmethod
    def get_file_url(path: str) -> str:
        """
        Get the URL for a stored file.
        
        Args:
            path: Path to the file
            
        Returns:
            URL to access the file
        """
        return default_storage.url(path)
    
    @staticmethod
    def file_exists(path: str) -> bool:
        """
        Check if a file exists in storage.
        
        Args:
            path: Path to the file
            
        Returns:
            True if file exists, False otherwise
        """
        return default_storage.exists(path)
    
    @staticmethod
    def delete_file(path: str) -> bool:
        """
        Delete a file from storage.
        
        Args:
            path: Path to the file
            
        Returns:
            True if file was deleted, False otherwise
        """
        if default_storage.exists(path):
            default_storage.delete(path)
            return True
        return False
    
    @staticmethod
    def get_file_size(path: str) -> int:
        """
        Get the size of a stored file.
        
        Args:
            path: Path to the file
            
        Returns:
            File size in bytes
        """
        return default_storage.size(path)
    
    @staticmethod
    def get_file_modified_time(path: str):
        """
        Get the last modified time of a stored file.
        
        Args:
            path: Path to the file
            
        Returns:
            datetime object representing last modified time
        """
        return default_storage.modified_time(path)
