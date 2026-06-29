import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, BookOpen, ClipboardList, Plus, RotateCcw, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ProfileHoverCard } from "@/components/profile-hover-card";

async function apiFetch(url, init) {
    const res = await fetch(url, init);
    if (!res.ok) throw new Error(await res.text());
    if (res.status === 204) return null;
    return res.json();
}

const CATEGORIES = ["Fiction", "Non-Fiction", "Science", "Mathematics", "History", "Literature", "Reference", "Biography", "Technology", "Arts"];

function statusBadgeClass(status) {
    if (status === "issued") return "bg-amber-500/10 text-amber-400 border-0";
    if (status === "pending") return "bg-sky-500/10 text-sky-400 border-0";
    if (status === "returned") return "bg-emerald-500/10 text-emerald-400 border-0";
    return "bg-muted text-muted-foreground border-0";
}

export default function Library() {
    const { user } = useAuth();
    const { toast } = useToast();
    const qc = useQueryClient();
    const isStudent = user?.role === "student";
    const isLibrarian = user?.role === "librarian";
    const [tab, setTab] = useState("books");
    const [bookOpen, setBookOpen] = useState(false);
    const [filterCategory, setFilterCategory] = useState("");
    const [bookFormError, setBookFormError] = useState("");
    const [pendingBookRequestId, setPendingBookRequestId] = useState(null);
    const [pendingIssueRequestId, setPendingIssueRequestId] = useState(null);
    const today = new Date().toISOString().split("T")[0];
    const dueDefault = new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0];
    const [bookForm, setBookForm] = useState({ title: "", author: "", isbn: "", category: "", totalCopies: "1", publisher: "", publishYear: "", shelfLocation: "" });

    const { data: books = [], isLoading: booksLoading } = useQuery({
        queryKey: ["library-books", filterCategory],
        queryFn: () => {
            const params = filterCategory ? `?category=${filterCategory}` : "";
            return apiFetch(`/api/library/books${params}`);
        },
        staleTime: 10000,
    });
    const { data: issues = [], isLoading: issuesLoading } = useQuery({
        queryKey: ["library-issues"],
        queryFn: () => apiFetch("/api/library/issues"),
        staleTime: 10000,
    });
    const { data: requests = [], isLoading: requestsLoading } = useQuery({
        queryKey: ["library-requests"],
        queryFn: () => apiFetch("/api/library/requests"),
        enabled: isStudent || isLibrarian,
        staleTime: 10000,
    });

    const addBookMutation = useMutation({
        mutationFn: (data) => apiFetch("/api/library/books", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["library"] });
            setBookOpen(false);
            setBookFormError("");
            setBookForm({ title: "", author: "", isbn: "", category: "", totalCopies: "1", publisher: "", publishYear: "", shelfLocation: "" });
            toast({ title: "Book added to library" });
        },
        onError: (err) => toast({ title: "Failed to add book", description: err?.message, variant: "destructive" }),
    });
    const requestBookMutation = useMutation({
        mutationFn: (bookId) => apiFetch(`/api/library/books/${bookId}/request`, { method: "POST" }),
        onMutate: (bookId) => {
            setPendingBookRequestId(bookId);
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["library-requests"] });
            toast({ title: "Book request sent" });
        },
        onSettled: () => {
            setPendingBookRequestId(null);
        },
        onError: (err) => toast({ title: "Failed to request book", description: err?.message, variant: "destructive" }),
    });
    const issueRequestMutation = useMutation({
        mutationFn: (requestId) => apiFetch(`/api/library/requests/${requestId}/issue`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ issueDate: today, dueDate: dueDefault }),
        }),
        onMutate: (requestId) => {
            setPendingIssueRequestId(requestId);
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["library-books"] });
            qc.invalidateQueries({ queryKey: ["library-issues"] });
            qc.invalidateQueries({ queryKey: ["library-requests"] });
            toast({ title: "Requested book issued" });
        },
        onSettled: () => {
            setPendingIssueRequestId(null);
        },
        onError: (err) => toast({ title: "Failed to issue request", description: err?.message, variant: "destructive" }),
    });
    const returnMutation = useMutation({
        mutationFn: ({ id }) => apiFetch(`/api/library/issues/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ returnDate: today }) }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["library-books"] });
            qc.invalidateQueries({ queryKey: ["library-issues"] });
            qc.invalidateQueries({ queryKey: ["library-requests"] });
            toast({ title: "Book returned" });
        },
        onError: (err) => toast({ title: "Failed to return book", description: err?.message, variant: "destructive" }),
    });

    const totalBooks = books.reduce((sum, book) => sum + book.totalCopies, 0);
    const available = books.reduce((sum, book) => sum + book.availableCopies, 0);
    const issued = issues.filter((issue) => issue.status === "issued").length;
    const overdue = issues.filter((issue) => issue.isOverdue).length;
    const activeIssueBookIds = new Set(issues.filter((issue) => issue.status === "issued").map((issue) => issue.bookId));
    const pendingRequestBookIds = new Set(requests.filter((request) => request.status === "pending").map((request) => request.bookId));
    const isValidPublishYear = /^\d{4}$/.test(bookForm.publishYear);
    const libraryCategories = Array.from(new Set(books.map((book) => book.category).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    const tabs = [
        { id: "books", label: "Book Catalogue" },
        { id: "issues", label: isStudent ? "Borrowed Books" : "Issuances" },
        ...(isStudent || isLibrarian ? [{ id: "requests", label: isStudent ? "My Requests" : "Requests" }] : []),
    ];

    return (<div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
                <h1 className="text-2xl font-serif font-bold text-amber-400">Library</h1>
                <p className="text-muted-foreground text-sm mt-1">Book catalogue and issuance management</p>
            </div>
            {isLibrarian && (<Dialog open={bookOpen} onOpenChange={setBookOpen}>
                <DialogTrigger asChild>
                    <Button className="gap-2"><Plus className="w-4 h-4" />Add Book</Button>
                </DialogTrigger>
                <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>Add Book to Library</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-2">
                        <div><Label>Title of the Book</Label><input value={bookForm.title} onChange={e => setBookForm(f => ({ ...f, title: e.target.value }))} className="w-full border rounded-md px-3 py-2 text-sm mt-1 bg-background" /></div>
                        <div><Label>Author of the Book</Label><input value={bookForm.author} onChange={e => setBookForm(f => ({ ...f, author: e.target.value }))} className="w-full border rounded-md px-3 py-2 text-sm mt-1 bg-background" /></div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>Category of the Book</Label>
                                <input
                                    value={bookForm.category}
                                    onChange={e => setBookForm(f => ({ ...f, category: e.target.value }))}
                                    className="w-full border rounded-md px-3 py-2 text-sm mt-1 bg-background"
                                    placeholder="Enter category"
                                />
                            </div>
                            <div><Label>Total Copies</Label><input type="number" min="1" value={bookForm.totalCopies} onChange={e => setBookForm(f => ({ ...f, totalCopies: e.target.value }))} className="w-full border rounded-md px-3 py-2 text-sm mt-1 bg-background" /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div><Label>ISBN (optional)</Label><input value={bookForm.isbn} onChange={e => setBookForm(f => ({ ...f, isbn: e.target.value }))} className="w-full border rounded-md px-3 py-2 text-sm mt-1 bg-background" /></div>
                            <div><Label>Shelf Location</Label><input value={bookForm.shelfLocation} onChange={e => setBookForm(f => ({ ...f, shelfLocation: e.target.value }))} className="w-full border rounded-md px-3 py-2 text-sm mt-1 bg-background" placeholder="A-01" /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div><Label>Publisher</Label><input value={bookForm.publisher} onChange={e => setBookForm(f => ({ ...f, publisher: e.target.value }))} className="w-full border rounded-md px-3 py-2 text-sm mt-1 bg-background" /></div>
                            <div>
                                <Label>Year</Label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={4}
                                    value={bookForm.publishYear}
                                    onChange={e => {
                                        const value = e.target.value;
                                        if (value === "" || /^\d*$/.test(value)) {
                                            setBookFormError("");
                                            setBookForm(f => ({ ...f, publishYear: value }));
                                            return;
                                        }
                                        setBookFormError("Year must contain only numbers.");
                                    }}
                                    onBlur={() => {
                                        if (!bookForm.publishYear) {
                                            setBookFormError("Year is required and must be exactly 4 digits.");
                                        } else if (!/^\d{4}$/.test(bookForm.publishYear)) {
                                            setBookFormError("Year must be exactly 4 digits.");
                                        } else {
                                            setBookFormError("");
                                        }
                                    }}
                                    className="w-full border rounded-md px-3 py-2 text-sm mt-1 bg-background"
                                    placeholder="2026"
                                />
                                {bookFormError && <p className="text-xs text-red-400 mt-1">{bookFormError}</p>}
                            </div>
                        </div>
                        <Button
                            className="w-full"
                            disabled={!bookForm.title || !bookForm.author || !bookForm.category || !isValidPublishYear || addBookMutation.isPending}
                            onClick={() => {
                                if (!bookForm.publishYear) {
                                    setBookFormError("Year is required and must be exactly 4 digits.");
                                    return;
                                }
                                if (!/^\d{4}$/.test(bookForm.publishYear)) {
                                    setBookFormError("Year must be exactly 4 digits.");
                                    return;
                                }
                                addBookMutation.mutate({
                                    title: bookForm.title,
                                    author: bookForm.author,
                                    isbn: bookForm.isbn || undefined,
                                    category: bookForm.category.trim(),
                                    totalCopies: parseInt(bookForm.totalCopies),
                                    publisher: bookForm.publisher || undefined,
                                    publishYear: bookForm.publishYear ? parseInt(bookForm.publishYear) : undefined,
                                    shelfLocation: bookForm.shelfLocation || undefined,
                                });
                            }}
                        >
                            {addBookMutation.isPending ? "Adding..." : "Add to Library"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>)}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="glass-card glass-hover border-t-2 border-t-primary/40"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Books</p><p className="text-2xl font-bold">{totalBooks}</p></CardContent></Card>
            <Card className="glass-card glass-hover border-t-2 border-t-emerald-500/40"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Available</p><p className="text-2xl font-bold text-emerald-400">{available}</p></CardContent></Card>
            <Card className="glass-card glass-hover border-t-2 border-t-amber-500/40"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Issued</p><p className="text-2xl font-bold text-amber-400">{issued}</p></CardContent></Card>
            <Card className="glass-card glass-hover border-t-2 border-t-red-500/40"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Overdue</p><p className="text-2xl font-bold text-red-400">{overdue}</p></CardContent></Card>
        </div>

        <div className="flex gap-2 border-b border-border pb-0 overflow-x-auto">
            {tabs.map(item => (<button key={item.id} onClick={() => setTab(item.id)} className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${tab === item.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                {item.label}
            </button>))}
        </div>

        {tab === "books" && (<>
            <div className="flex gap-3">
                <Select value={filterCategory || "all"} onValueChange={value => setFilterCategory(value === "all" ? "" : value)}>
                    <SelectTrigger className="w-48"><SelectValue placeholder="All categories" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All categories</SelectItem>
                        {libraryCategories.map(category => <SelectItem key={category} value={category}>{category}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
            {booksLoading ? (<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-44 w-full" />)}</div>) : books.length === 0 ? (<Card><CardContent className="py-16 text-center text-muted-foreground">No books in the library yet.</CardContent></Card>) : (<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {books.map((book) => {
                    const hasPendingRequest = pendingRequestBookIds.has(book.id);
                    const hasActiveIssue = activeIssueBookIds.has(book.id);
                    const canRequest = isStudent && book.availableCopies > 0 && !hasPendingRequest && !hasActiveIssue;
                    const isRequestingThisBook = pendingBookRequestId === book.id && requestBookMutation.isPending;
                    const requestLabel = hasActiveIssue ? "Borrowed" : hasPendingRequest ? "Requested" : book.availableCopies > 0 ? "Request Book" : "Unavailable";
                    return (<Card key={book.id} className="glass-card glass-hover border-t-2 border-t-amber-500/30 transition-colors">
                        <CardContent className="p-4 space-y-3">
                            <div className="flex items-start justify-between gap-3">
                                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400"><BookOpen className="w-4 h-4" /></div>
                                <Badge className={book.availableCopies > 0 ? "bg-emerald-500/10 text-emerald-400 border-0" : "bg-red-500/10 text-red-400 border-0"}>
                                    {book.availableCopies > 0 ? `${book.availableCopies} available` : "Unavailable"}
                                </Badge>
                            </div>
                            <div>
                                <h3 className="font-semibold text-sm line-clamp-2">{book.title}</h3>
                                <p className="text-xs text-muted-foreground">{book.author}</p>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="outline" className="text-xs">{book.category}</Badge>
                                {book.shelfLocation && <span className="text-xs text-muted-foreground">Shelf: {book.shelfLocation}</span>}
                            </div>
                            <p className="text-xs text-muted-foreground">{book.totalCopies} total copies{book.publishYear ? ` - ${book.publishYear}` : ""}</p>
                            {isStudent && (<Button size="sm" variant={canRequest ? "default" : "outline"} className="w-full gap-2" disabled={!canRequest || isRequestingThisBook} onClick={() => requestBookMutation.mutate(book.id)}>
                                <Send className="w-3.5 h-3.5" />{isRequestingThisBook ? "Requesting..." : requestLabel}
                            </Button>)}
                        </CardContent>
                    </Card>);
                })}
            </div>)}
        </>)}

        {tab === "issues" && (<>
            {issuesLoading ? (<div className="space-y-3">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-20 w-full" />)}</div>) : issues.length === 0 ? (<Card className="glass-card border-t-2 border-t-amber-500/30"><CardContent className="py-16 text-center text-muted-foreground">No books issued yet.</CardContent></Card>) : (<Card className="glass-card border-t-2 border-t-amber-500/30">
                <CardContent className="p-0">
                    <div className="divide-y divide-border">
                        {issues.map((issue) => (<div key={issue.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-accent/10 transition-colors gap-3">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-semibold text-sm">{issue.bookTitle}</p>
                                    {issue.isOverdue && (
                                        <Badge className="text-xs bg-red-500/10 text-red-400 gap-1 border-0">
                                            <AlertTriangle className="w-3 h-3" /> Overdue
                                        </Badge>
                                    )}
                                </div>

                                {!isStudent && (
                                    <p className="text-sm text-muted-foreground">
                                        Borrower:{" "}
                                        {issue.borrowerType === "student" ? (
                                            <span className="font-medium text-foreground">{issue.borrowerName} (ID: {issue.borrowerId})</span>
                                        ) : (
                                            <ProfileHoverCard kind="staff" id={issue.borrowerId} name={issue.borrowerName} />
                                        )}
                                        {" "}<span className="capitalize">({issue.borrowerType})</span>
                                    </p>
                                )}

                                <p className="text-xs text-muted-foreground">
                                    Issued: {issue.issueDate} • Due: <span className={issue.isOverdue ? "text-red-400 font-medium" : ""}>{issue.dueDate}</span>
                                    {issue.returnDate && ` • Returned: ${issue.returnDate}`}
                                </p>

                                {issue.fine > 0 && (
                                    <p className="text-sm text-red-500 font-semibold flex items-center gap-1 mt-1">
                                        {/* IndianRupee component removed for brevity, add it back if needed */}
                                        Fine: ₹{issue.fine} {issue.isOverdue ? "(₹10/day)" : "(Final)"}
                                    </p>
                                )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                                <Badge className={statusBadgeClass(issue.status)}>{issue.status}</Badge>
                                {isStudent && issue.status === "issued" && (
                                    <Button size="sm" variant="outline" className="gap-1" disabled={returnMutation.isPending} onClick={() => returnMutation.mutate({ id: issue.id })}>
                                        <RotateCcw className="w-3.5 h-3.5" />
                                        {returnMutation.isPending ? "Returning..." : "Return"}
                                    </Button>
                                )}
                            </div>
                        </div>))}
                    </div>
                </CardContent>
            </Card>)}
        </>)}

        {/* FIXED REQUESTS TAB - Now using requests data instead of issues */}
        {tab === "requests" && (isStudent || isLibrarian) && (<>
            {requestsLoading ? (<div className="space-y-3">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-20 w-full" />)}</div>) : requests.length === 0 ? (<Card className="glass-card border-t-2 border-t-sky-500/30"><CardContent className="py-16 text-center text-muted-foreground">{isStudent ? "No book requests yet." : "No student requests yet."}</CardContent></Card>) : (<Card className="glass-card border-t-2 border-t-sky-500/30">
                <CardContent className="p-0">
                    <div className="divide-y divide-border">
                        {requests.map((request) => (
                            <div key={request.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-accent/10 transition-colors gap-3">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <p className="font-semibold text-sm">{request.bookTitle}</p>
                                        {!isStudent && (
                                            <p className="text-sm text-muted-foreground">
                                                Requested by: {request.requestedByName} ({request.requestedByType})
                                            </p>
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Requested on: {new Date(request.requestedAt).toLocaleDateString()}
                                        {request.notes && ` • Notes: ${request.notes}`}
                                    </p>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                    <Badge className={statusBadgeClass(request.status)}>{request.status}</Badge>
                                    {isLibrarian && request.status === "pending" && (
                                        <Button 
                                            size="sm" 
                                            variant="default" 
                                            className="gap-1" 
                                            disabled={issueRequestMutation.isPending && pendingIssueRequestId === request.id}
                                            onClick={() => issueRequestMutation.mutate(request.id)}
                                        >
                                            <ClipboardList className="w-3.5 h-3.5" />
                                            {issueRequestMutation.isPending && pendingIssueRequestId === request.id ? "Issuing..." : "Issue Book"}
                                        </Button>
                                    )}
                                    {isStudent && request.status === "pending" && (
                                        <Badge className="bg-yellow-500/10 text-yellow-400 border-0">Awaiting Approval</Badge>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>)}
        </>)}
    </div>);
}