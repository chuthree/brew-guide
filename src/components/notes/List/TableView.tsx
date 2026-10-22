'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  sortingFns,
  type ColumnDef,
  type ColumnSizingState,
  type SortingFn,
  type SortingState,
} from '@tanstack/react-table';
import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';
import type { BrewingNote } from '@/lib/core/config';
import type { CoffeeBeanLookup } from '@/lib/notes/noteDisplay';
import {
  getBeanUnitPrice,
  getNoteBeanAgingDaysForNote,
  normalizeBrewingNoteParams,
  getNoteEspressoParamParts,
  resolveNoteBean,
  resolveNoteBeanDisplayName,
  resolveNoteEquipmentName,
  resolveNoteMethodName,
} from '@/lib/notes/noteDisplay';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import { useFlavorDimensions } from '@/lib/hooks/useFlavorDimensions';
import { formatDateAbsolute } from '../utils';
import {
  getNotesTableColumnConfig,
  type NotesTableColumnKey,
} from './tableColumns';

interface NotesTableViewProps {
  notes: BrewingNote[];
  equipmentNames: Record<string, string>;
  coffeeBeanLookup?: CoffeeBeanLookup;
  visibleColumns: NotesTableColumnKey[];
  isShareMode?: boolean;
  selectedNotes?: string[];
  onToggleSelect?: (noteId: string, enterShareMode?: boolean) => void;
  activeNoteId?: string | null;
}

const DEFAULT_SORTING: SortingState = [];
const SORTING_STORAGE_KEY = 'brew-guide:notes:tableSorting:v1';
const COLUMN_SIZING_STORAGE_KEY = 'brew-guide:notes:tableColumnSizing:v1';
const DEFAULT_COLUMN_MIN_SIZE = 44;
const DEFAULT_COLUMN_MAX_SIZE = 1600;
const TABLE_HORIZONTAL_PADDING = 0;

const STATIC_COLUMN_SIZE_CONFIG: Record<
  NotesTableColumnKey,
  { size: number; minSize: number; maxSize?: number }
> = {
  date: { size: 82, minSize: 68, maxSize: DEFAULT_COLUMN_MAX_SIZE },
  bean: { size: 168, minSize: 88, maxSize: DEFAULT_COLUMN_MAX_SIZE },
  agingDays: { size: 64, minSize: 48, maxSize: DEFAULT_COLUMN_MAX_SIZE },
  scheme: { size: 112, minSize: 60, maxSize: DEFAULT_COLUMN_MAX_SIZE },
  params: { size: 128, minSize: 64, maxSize: DEFAULT_COLUMN_MAX_SIZE },
  tasteRatings: { size: 56, minSize: 44, maxSize: DEFAULT_COLUMN_MAX_SIZE },
  totalRating: { size: 54, minSize: 44, maxSize: DEFAULT_COLUMN_MAX_SIZE },
  notes: { size: 420, minSize: 96, maxSize: DEFAULT_COLUMN_MAX_SIZE },
};

const SELECTION_COLUMN_SIZE = { size: 44, minSize: 40, maxSize: 56 };

const loadSorting = (): SortingState => {
  if (typeof window === 'undefined') return DEFAULT_SORTING;

  try {
    const saved = localStorage.getItem(SORTING_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : null;
    return Array.isArray(parsed) ? parsed : DEFAULT_SORTING;
  } catch {
    return DEFAULT_SORTING;
  }
};

const saveSorting = (sorting: SortingState) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SORTING_STORAGE_KEY, JSON.stringify(sorting));
};

const loadColumnSizing = (): ColumnSizingState => {
  if (typeof window === 'undefined') return {};

  try {
    const saved = localStorage.getItem(COLUMN_SIZING_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : null;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const saveColumnSizing = (columnSizing: ColumnSizingState) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(COLUMN_SIZING_STORAGE_KEY, JSON.stringify(columnSizing));
};

const SortIcon: React.FC<{
  direction: 'asc' | 'desc' | false;
  index?: number;
}> = ({ direction, index }) => {
  if (!direction) {
    return (
      <ChevronsUpDown className="ml-0.5 inline-block h-3 w-3 text-neutral-300 dark:text-neutral-600" />
    );
  }

  return (
    <span className="ml-0.5 inline-flex items-center text-neutral-800 dark:text-neutral-200">
      {direction === 'asc' ? (
        <ChevronUp className="h-3 w-3" />
      ) : (
        <ChevronDown className="h-3 w-3" />
      )}
      {index !== undefined && index > 0 && (
        <span className="ml-0.5 text-[10px] text-neutral-400">{index + 1}</span>
      )}
    </span>
  );
};

const EmptyCell: React.FC = () => (
  <span className="text-neutral-300 dark:text-neutral-700">-</span>
);

const columnHelper = createColumnHelper<BrewingNote>();

const getColumnSizing = (columnKey: NotesTableColumnKey) =>
  STATIC_COLUMN_SIZE_CONFIG[columnKey];

const getTasteColumnKey = (dimensionId: string) => `taste:${dimensionId}`;

const isChangeRecordNote = (note: BrewingNote): boolean =>
  note.source === 'quick-decrement' ||
  note.source === 'capacity-adjustment' ||
  note.source === 'roasting';

const getSortingDesc = (sorting: SortingState, columnId: string): boolean =>
  sorting.find(sort => sort.id === columnId)?.desc === true;

const compareChangeRecordGroup = (
  rowA: { original: BrewingNote },
  rowB: { original: BrewingNote },
  isDesc: boolean
): number => {
  const aChangeRecord = isChangeRecordNote(rowA.original);
  const bChangeRecord = isChangeRecordNote(rowB.original);

  if (aChangeRecord === bChangeRecord) return 0;

  // TanStack reverses sortingFn output for descending sorts. Flip the grouping
  // result first so change records stay at the bottom in either direction.
  const result = aChangeRecord ? 1 : -1;
  return isDesc ? -result : result;
};

const createGroupedSortingFn =
  (
    sorting: SortingState,
    baseSortingFn: SortingFn<BrewingNote>
  ): SortingFn<BrewingNote> =>
  (rowA, rowB, columnId) => {
    const groupResult = compareChangeRecordGroup(
      rowA,
      rowB,
      getSortingDesc(sorting, columnId)
    );

    if (groupResult !== 0) return groupResult;

    return baseSortingFn(rowA, rowB, columnId);
  };

const getSchemeDisplay = (
  note: BrewingNote,
  equipmentNames: Record<string, string>
): string => {
  const equipmentName = resolveNoteEquipmentName(note, equipmentNames);
  const methodName = resolveNoteMethodName(note);
  const parts = [equipmentName, methodName].filter(Boolean);

  return parts.length > 0 ? parts.join(' / ') : '-';
};

const getParamsDisplay = (note: BrewingNote): string => {
  const normalizedParams = normalizeBrewingNoteParams(note.params);
  if (!normalizedParams) {
    return '-';
  }

  if (
    note.equipment?.toLowerCase().includes('espresso') ||
    note.equipment?.includes('意式')
  ) {
    const parts = getNoteEspressoParamParts(note);

    return parts.length > 0 ? parts.join(' / ') : '-';
  }

  const parts = [
    normalizedParams.coffee,
    normalizedParams.ratio,
    normalizedParams.grindSize,
    normalizedParams.temp,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(' / ') : '-';
};

const NotesTableView: React.FC<NotesTableViewProps> = ({
  notes,
  equipmentNames,
  coffeeBeanLookup,
  visibleColumns,
  isShareMode = false,
  selectedNotes = [],
  onToggleSelect,
  activeNoteId,
}) => {
  const [sorting, setSorting] = useState<SortingState>(loadSorting);
  const [columnSizing, setColumnSizing] =
    useState<ColumnSizingState>(loadColumnSizing);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const { getValidTasteRatings } = useFlavorDimensions();
  const roasterFieldEnabled = useSettingsStore(
    state => state.settings.roasterFieldEnabled
  );
  const roasterSeparator = useSettingsStore(
    state => state.settings.roasterSeparator
  );
  const roasterSettings = useMemo(
    () => ({
      roasterFieldEnabled,
      roasterSeparator,
    }),
    [roasterFieldEnabled, roasterSeparator]
  );
  const columnConfig = useMemo(() => getNotesTableColumnConfig(), []);

  const handleSortingChange = useCallback(
    (updater: SortingState | ((old: SortingState) => SortingState)) => {
      setSorting(old => {
        const nextSorting =
          typeof updater === 'function' ? updater(old) : updater;
        saveSorting(nextSorting);
        return nextSorting;
      });
    },
    []
  );

  const handleColumnSizingChange = useCallback(
    (
      updater:
        | ColumnSizingState
        | ((old: ColumnSizingState) => ColumnSizingState)
    ) => {
      setColumnSizing(old => {
        const nextSizing =
          typeof updater === 'function' ? updater(old) : updater;
        saveColumnSizing(nextSizing);
        return nextSizing;
      });
    },
    []
  );

  const handleRowClick = useCallback(
    (note: BrewingNote) => {
      if (isShareMode) {
        onToggleSelect?.(note.id);
        return;
      }

      const beanInfo = resolveNoteBean(note, coffeeBeanLookup);

      window.dispatchEvent(
        new CustomEvent('noteDetailOpened', {
          detail: {
            note,
            equipmentName: resolveNoteEquipmentName(note, equipmentNames),
            beanUnitPrice: getBeanUnitPrice(beanInfo),
            beanInfo,
          },
        })
      );
    },
    [coffeeBeanLookup, equipmentNames, isShareMode, onToggleSelect]
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const columns = useMemo<ColumnDef<BrewingNote, any>[]>(() => {
    const alphanumericSortingFn = createGroupedSortingFn(
      sorting,
      sortingFns.alphanumeric as SortingFn<BrewingNote>
    );
    const basicSortingFn = createGroupedSortingFn(
      sorting,
      sortingFns.basic as SortingFn<BrewingNote>
    );

    const columnByKey: Record<
      NotesTableColumnKey,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ColumnDef<BrewingNote, any>
    > = {
      date: columnHelper.accessor(row => row.timestamp, {
        id: 'date',
        header: '日期',
        cell: info => formatDateAbsolute(info.getValue()),
        sortingFn: basicSortingFn,
        ...getColumnSizing('date'),
      }),
      bean: columnHelper.accessor(
        row =>
          resolveNoteBeanDisplayName(row, coffeeBeanLookup, roasterSettings),
        {
          id: 'bean',
          header: '咖啡豆',
          cell: info => info.getValue() || <EmptyCell />,
          sortingFn: alphanumericSortingFn,
          ...getColumnSizing('bean'),
        }
      ),
      agingDays: columnHelper.accessor(
        row => {
          const agingDays = getNoteBeanAgingDaysForNote(
            row,
            resolveNoteBean(row, coffeeBeanLookup)
          );

          return agingDays ?? -1;
        },
        {
          id: 'agingDays',
          header: '养豆',
          cell: info => {
            const agingDays = info.getValue();
            return agingDays >= 0 ? `${agingDays}天` : <EmptyCell />;
          },
          sortingFn: basicSortingFn,
          ...getColumnSizing('agingDays'),
        }
      ),
      scheme: columnHelper.accessor(
        row => getSchemeDisplay(row, equipmentNames),
        {
          id: 'scheme',
          header: '方案',
          cell: info => info.getValue() || <EmptyCell />,
          sortingFn: alphanumericSortingFn,
          ...getColumnSizing('scheme'),
        }
      ),
      params: columnHelper.accessor(row => getParamsDisplay(row), {
        id: 'params',
        header: '参数',
        cell: info =>
          info.getValue() === '-' ? <EmptyCell /> : info.getValue(),
        sortingFn: alphanumericSortingFn,
        ...getColumnSizing('params'),
      }),
      tasteRatings: columnHelper.display({
        id: 'tasteRatings',
        header: '评分维度',
        cell: () => null,
        enableSorting: false,
        enableResizing: false,
        ...getColumnSizing('tasteRatings'),
      }),
      totalRating: columnHelper.accessor(row => row.rating || 0, {
        id: 'totalRating',
        header: '总评',
        cell: info => {
          const rating = info.getValue();
          return rating > 0 ? rating : <EmptyCell />;
        },
        sortingFn: basicSortingFn,
        ...getColumnSizing('totalRating'),
      }),
      notes: columnHelper.accessor(row => row.notes || '', {
        id: 'notes',
        header: '备注',
        cell: info => info.getValue() || <EmptyCell />,
        sortingFn: alphanumericSortingFn,
        ...getColumnSizing('notes'),
      }),
    };

    const tasteRatings = notes.reduce<
      Array<{ id: string; label: string; value: number }>
    >((ratings, note) => {
      getValidTasteRatings(note.taste).forEach(rating => {
        if (!ratings.some(item => item.id === rating.id)) {
          ratings.push(rating);
        }
      });

      return ratings;
    }, []);

    const tasteColumns = tasteRatings.map(rating =>
      columnHelper.accessor(row => row.taste?.[rating.id] ?? 0, {
        id: getTasteColumnKey(rating.id),
        header: rating.label,
        cell: info => {
          const value = info.getValue();
          return value > 0 ? value : <EmptyCell />;
        },
        sortingFn: basicSortingFn,
        ...getColumnSizing('tasteRatings'),
      })
    );

    const dataColumns = columnConfig
      .flatMap(column => {
        if (column.key === 'tasteRatings') {
          return visibleColumns.includes(column.key) ? tasteColumns : [];
        }

        return visibleColumns.includes(column.key)
          ? [columnByKey[column.key]]
          : [];
      })
      .filter((column): column is ColumnDef<BrewingNote, any> =>
        Boolean(column)
      );

    if (!isShareMode) {
      return dataColumns;
    }

    return [
      columnHelper.display({
        id: 'select',
        header: '',
        cell: ({ row }) => {
          const note = row.original;

          return (
            <input
              type="checkbox"
              checked={selectedNotes.includes(note.id)}
              onChange={() => onToggleSelect?.(note.id)}
              onClick={event => event.stopPropagation()}
              aria-label="选择笔记"
              className="relative h-4 w-4 appearance-none rounded-sm border border-neutral-300 text-xs checked:bg-neutral-800 checked:after:absolute checked:after:top-1/2 checked:after:left-1/2 checked:after:-translate-x-1/2 checked:after:-translate-y-1/2 checked:after:text-white checked:after:content-['✓'] dark:border-neutral-700 dark:checked:bg-neutral-200 dark:checked:after:text-black"
            />
          );
        },
        enableSorting: false,
        enableResizing: false,
        ...SELECTION_COLUMN_SIZE,
      }),
      ...dataColumns,
    ];
  }, [
    columnConfig,
    coffeeBeanLookup,
    equipmentNames,
    getValidTasteRatings,
    isShareMode,
    notes,
    onToggleSelect,
    roasterSettings,
    selectedNotes,
    sorting,
    visibleColumns,
  ]);

  const table = useReactTable({
    data: notes,
    columns,
    state: { sorting, columnSizing },
    onSortingChange: handleSortingChange,
    onColumnSizingChange: handleColumnSizingChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableMultiSort: true,
    isMultiSortEvent: () => true,
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
  });

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const updateContainerWidth = () => {
      setContainerWidth(container.clientWidth);
    };

    updateContainerWidth();

    const resizeObserver = new ResizeObserver(updateContainerWidth);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  const visibleLeafColumns = table.getVisibleLeafColumns();
  const tableBaseWidth = table.getTotalSize();
  const tableDisplayWidth = Math.max(
    tableBaseWidth,
    containerWidth - TABLE_HORIZONTAL_PADDING
  );
  const fillColumnId =
    visibleLeafColumns.find(column => column.id === 'notes')?.id ??
    visibleLeafColumns[visibleLeafColumns.length - 1]?.id;
  const extraWidth = Math.max(0, tableDisplayWidth - tableBaseWidth);
  const getDisplayColumnWidth = (columnId: string, baseWidth: number) =>
    columnId === fillColumnId ? baseWidth + extraWidth : baseWidth;

  if (notes.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-xs leading-relaxed font-medium text-neutral-600 dark:text-neutral-400">
        [ 暂无冲煮记录，请点击下方按钮添加 ]
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <div
        ref={scrollContainerRef}
        className="scroll-with-bottom-bar h-full overflow-x-auto overflow-y-auto overscroll-none pb-20"
        style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
      >
        <table
          className="border-separate border-spacing-0"
          style={{
            tableLayout: 'fixed',
            width: tableDisplayWidth,
            minWidth: tableDisplayWidth,
          }}
        >
          <colgroup>
            {visibleLeafColumns.map(column => (
              <col
                key={column.id}
                style={{
                  width: getDisplayColumnWidth(column.id, column.getSize()),
                }}
              />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-10 bg-neutral-50 dark:bg-neutral-900">
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header, index) => {
                  const isFirst = index === 0;
                  const isLast = index === headerGroup.headers.length - 1;
                  const paddingClass = `py-2 ${isFirst ? 'pl-6 pr-3' : isLast ? 'pl-3 pr-6' : 'px-3'}`;
                  const sortIndex = sorting.findIndex(s => s.id === header.id);
                  const isSorted = header.column.getIsSorted();
                  const canSort = header.column.getCanSort();
                  const canResize = header.column.getCanResize();
                  const isResizing = header.column.getIsResizing();
                  const resizeHandler = header.getResizeHandler();

                  return (
                    <th
                      key={header.id}
                      className="group relative border-b border-neutral-200/50 bg-neutral-50 text-left text-xs leading-relaxed font-medium whitespace-nowrap text-neutral-600 select-none dark:border-neutral-800/50 dark:bg-neutral-900 dark:text-neutral-400"
                      style={{
                        width: getDisplayColumnWidth(
                          header.column.id,
                          header.getSize()
                        ),
                        minWidth:
                          header.column.columnDef.minSize ??
                          DEFAULT_COLUMN_MIN_SIZE,
                      }}
                    >
                      {header.isPlaceholder ? null : (
                        <div
                          className={`relative flex items-center ${paddingClass}`}
                        >
                          <button
                            type="button"
                            className={`inline-flex min-w-0 items-center ${
                              canSort
                                ? 'cursor-pointer hover:text-neutral-800 dark:hover:text-neutral-200'
                                : 'cursor-default'
                            }`}
                            onClick={
                              canSort
                                ? header.column.getToggleSortingHandler()
                                : undefined
                            }
                          >
                            <span className="min-w-0 truncate">
                              {flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                            </span>
                            {canSort && (
                              <SortIcon
                                direction={isSorted}
                                index={
                                  sorting.length > 1 ? sortIndex : undefined
                                }
                              />
                            )}
                          </button>
                          {canResize && (
                            <div
                              role="separator"
                              aria-label="调整列宽"
                              aria-orientation="vertical"
                              className={`absolute top-0 right-0 z-20 h-full w-4 translate-x-1/2 cursor-col-resize touch-none ${
                                isResizing
                                  ? 'opacity-100'
                                  : 'opacity-0 transition-opacity group-hover:opacity-100 hover:opacity-100'
                              }`}
                              onMouseDown={resizeHandler}
                              onTouchStart={resizeHandler}
                              onDoubleClick={() => header.column.resetSize()}
                              onClick={event => event.stopPropagation()}
                            >
                              <span
                                className={`absolute top-1/2 left-1/2 h-3 w-px -translate-x-1/2 -translate-y-1/2 rounded-full bg-neutral-200 transition-opacity dark:bg-neutral-800 ${
                                  isResizing ? 'opacity-100' : 'opacity-70'
                                }`}
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map(row => {
              const note = row.original;
              const isSelected = selectedNotes.includes(note.id);
              const isActive = activeNoteId === note.id;
              const isChangeRecord = isChangeRecordNote(note);

              return (
                <tr
                  key={row.id}
                  className={`cursor-pointer hover:bg-neutral-100 active:bg-neutral-100 dark:hover:bg-neutral-800/30 dark:active:bg-neutral-800/30 ${
                    isSelected ? 'bg-neutral-100 dark:bg-neutral-800/30' : ''
                  } ${isActive ? 'bg-neutral-100 dark:bg-neutral-800/30' : ''} ${isChangeRecord ? 'opacity-50' : ''}`}
                  onClick={() => handleRowClick(note)}
                  aria-selected={isSelected || isActive}
                >
                  {row.getVisibleCells().map((cell, index) => {
                    const isFirst = index === 0;
                    const isLast = index === row.getVisibleCells().length - 1;
                    const paddingClass = `py-2.5 ${isFirst ? 'pl-6 pr-3' : isLast ? 'pl-3 pr-6' : 'px-3'}`;

                    return (
                      <td
                        key={cell.id}
                        className={`border-b border-neutral-200/50 text-xs leading-relaxed font-medium text-neutral-600 dark:border-neutral-800/50 dark:text-neutral-400 ${paddingClass}`}
                        style={{
                          width: getDisplayColumnWidth(
                            cell.column.id,
                            cell.column.getSize()
                          ),
                        }}
                        onClick={
                          cell.column.id === 'select'
                            ? event => event.stopPropagation()
                            : undefined
                        }
                        title={
                          typeof cell.getValue() === 'string'
                            ? cell.getValue<string>()
                            : undefined
                        }
                      >
                        <div className="min-w-0 truncate">
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default NotesTableView;
