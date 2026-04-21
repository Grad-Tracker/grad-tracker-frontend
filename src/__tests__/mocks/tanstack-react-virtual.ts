type UseVirtualizerArgs = {
  count: number;
  estimateSize: (index: number) => number;
};

type VirtualItem = {
  index: number;
  key: number;
  start: number;
  size: number;
  end: number;
};

export function useVirtualizer({ count, estimateSize }: UseVirtualizerArgs) {
  let offset = 0;
  const items: VirtualItem[] = Array.from({ length: count }, (_, index) => {
    const size = estimateSize(index);
    const item = { index, key: index, start: offset, size, end: offset + size };
    offset += size;
    return item;
  });

  return {
    getVirtualItems: () => items,
    getTotalSize: () => offset,
    measureElement: () => undefined,
  };
}
