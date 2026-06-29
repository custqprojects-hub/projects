import { useMemo, useState, useEffect } from "react";
import { Search, ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
export function DataTable({ data, columns, rowKey, isLoading, searchPlaceholder = "Search...", searchKeys, filters = [], pageSize: initialPageSize = 10, pageSizeOptions = [10, 25, 50, 100], onRowClick, rowClassName, emptyTitle = "No results found", emptyDescription = "Try adjusting your search or filters.", toolbarExtra, hideSearch = false, }) {
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(initialPageSize);
    // Reset to first page when filters/search/data length change
    useEffect(() => {
        setPage(1);
    }, [search, pageSize, ...filters.map((f) => f.value), data.length]); // eslint-disable-line react-hooks/exhaustive-deps
    const filtered = useMemo(() => {
        let rows = data;
        // Apply filter predicates
        for (const f of filters) {
            if (f.value && f.value !== "all" && f.value !== "") {
                rows = rows.filter((r) => f.predicate(r, f.value));
            }
        }
        // Apply search
        if (search.trim() && searchKeys && searchKeys.length > 0) {
            const q = search.trim().toLowerCase();
            rows = rows.filter((r) => searchKeys.some((k) => {
                const v = typeof k === "function" ? k(r) : r[k];
                return v != null && String(v).toLowerCase().includes(q);
            }));
        }
        return rows;
    }, [data, search, filters, searchKeys]);
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const safePage = Math.min(page, totalPages);
    const paged = useMemo(() => filtered.slice((safePage - 1) * pageSize, safePage * pageSize), [filtered, safePage, pageSize]);
    const startRow = filtered.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
    const endRow = Math.min(safePage * pageSize, filtered.length);
    return (<div className="space-y-3">
      {/* Toolbar */}
      {(!hideSearch || filters.length > 0 || toolbarExtra) && (<div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-wrap gap-2 items-center">
            {!hideSearch && (<div className="relative flex-1 min-w-[180px] max-w-sm">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
                <Input placeholder={searchPlaceholder} className="pl-9 h-9" value={search} onChange={(e) => setSearch(e.target.value)}/>
              </div>)}
            {filters.map((f) => (<Select key={f.key} value={f.value || "all"} onValueChange={(v) => f.onChange(v === "all" ? "" : v)}>
                <SelectTrigger className={cn("h-9", f.width ?? "w-40")}>
                  <SelectValue placeholder={f.placeholder}/>
                </SelectTrigger>
                <SelectContent className={f.contentClassName}>
                  <SelectItem value="all">{f.allLabel ?? f.placeholder}</SelectItem>
                  {f.options.map((o) => (<SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>))}
                </SelectContent>
              </Select>))}
          </div>
          {toolbarExtra && <div className="flex gap-2 items-center">{toolbarExtra}</div>}
        </div>)}

      {/* Table */}
      <div className="overflow-x-auto">
        {isLoading ? (<div className="p-4 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (<Skeleton key={i} className="h-10 w-full"/>))}
          </div>) : paged.length === 0 ? (<div className="py-16 flex flex-col items-center gap-2 text-muted-foreground">
            <Inbox className="w-8 h-8 opacity-30"/>
            <p className="text-sm font-medium">{emptyTitle}</p>
            <p className="text-xs">{emptyDescription}</p>
          </div>) : (<Table>
            <TableHeader>
              <TableRow className="border-border/50 hover:bg-transparent">
                {columns.map((c) => (<TableHead key={c.key} className={cn("text-xs uppercase tracking-wider text-muted-foreground", c.align === "right" && "text-right", c.align === "center" && "text-center", c.headerClassName)}>
                    {c.header}
                  </TableHead>))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((row) => (<TableRow key={rowKey(row)} className={cn("border-border/40 transition-colors group", onRowClick && "cursor-pointer hover:bg-white/[0.03]", rowClassName?.(row))} onClick={onRowClick ? () => onRowClick(row) : undefined}>
                  {columns.map((c) => (<TableCell key={c.key} className={cn(c.align === "right" && "text-right", c.align === "center" && "text-center", c.className)}>
                      {c.cell(row)}
                    </TableCell>))}
                </TableRow>))}
            </TableBody>
          </Table>)}
      </div>

      {/* Pagination footer */}
      {!isLoading && filtered.length > 0 && (<div className="flex flex-col sm:flex-row gap-3 items-center justify-between text-xs text-muted-foreground pt-1">
          <div className="flex items-center gap-2">
            <span>
              {startRow}–{endRow} of {filtered.length}
            </span>
            <span className="opacity-50">·</span>
            <Select value={String(pageSize)} onValueChange={(v) => setPageSize(parseInt(v))}>
              <SelectTrigger className="h-7 w-[110px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((n) => (<SelectItem key={n} value={String(n)}>
                    {n} per page
                  </SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-7 px-2" disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              <ChevronLeft className="w-3.5 h-3.5"/>
            </Button>
            <span className="px-2 text-foreground">
              Page {safePage} / {totalPages}
            </span>
            <Button variant="outline" size="sm" className="h-7 px-2" disabled={safePage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
              <ChevronRight className="w-3.5 h-3.5"/>
            </Button>
          </div>
        </div>)}
    </div>);
}
