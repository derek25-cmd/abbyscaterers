'use client';

import { Button } from '@/components/ui/button';

export function LoadMoreButton({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" variant="outline" className="w-full" onClick={onClick}>
      Load more
    </Button>
  );
}
