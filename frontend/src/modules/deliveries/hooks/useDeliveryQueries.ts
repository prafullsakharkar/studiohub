import { useQuery } from '@tanstack/react-query';
import { deliveryService } from '../services/DeliveryService';

export const DELIVERY_QUERY_KEYS = {
  all: ['deliveries'] as const,
  lists: () => [...DELIVERY_QUERY_KEYS.all, 'list'] as const,
  list: () => [...DELIVERY_QUERY_KEYS.lists()] as const,
  details: () => [...DELIVERY_QUERY_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...DELIVERY_QUERY_KEYS.details(), id] as const,
  destinations: () => [...DELIVERY_QUERY_KEYS.all, 'destinations'] as const,
};

export function useDeliveryList() {
  return useQuery({
    queryKey: DELIVERY_QUERY_KEYS.list(),
    queryFn: () => deliveryService.getDeliveries(),
  });
}

export function useDeliveryDetail(id?: string) {
  return useQuery({
    queryKey: id ? DELIVERY_QUERY_KEYS.detail(id) : [...DELIVERY_QUERY_KEYS.details(), 'null'],
    queryFn: async () => {
      if (!id) throw new Error('Delivery ID required');
      const delivery = await deliveryService.getDeliveryById(id);
      if (!delivery) throw new Error('Delivery package not found');
      return delivery;
    },
    enabled: !!id,
  });
}

export function useDeliveryDestinations() {
  return useQuery({
    queryKey: DELIVERY_QUERY_KEYS.destinations(),
    queryFn: () => deliveryService.getDestinations(),
    // Destinations are static config-like data (DB-backed reference rows).
    staleTime: Infinity,
  });
}
