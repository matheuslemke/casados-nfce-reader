import { Authenticated, Unauthenticated, useQuery, useMutation, useAction } from "convex/react";
import { api } from "../convex/_generated/api";
import { SignInForm } from "./SignInForm";
import { SignOutButton } from "./SignOutButton";
import { Toaster, toast } from "sonner";
import { useState } from "react";
import { Id } from "../convex/_generated/dataModel";

export default function App() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm h-16 flex justify-between items-center border-b shadow-sm px-4">
        <h2 className="text-xl font-semibold text-primary">NFC-e Crawler</h2>
        <SignOutButton />
      </header>
      <main className="flex-1 p-8">
        <div className="w-full max-w-6xl mx-auto">
          <Content />
        </div>
      </main>
      <Toaster />
    </div>
  );
}

function Content() {
  const loggedInUser = useQuery(api.auth.loggedInUser);

  if (loggedInUser === undefined) {
    return (
      <div className="flex justify-center items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <Authenticated>
        <InvoiceManager />
      </Authenticated>
      <Unauthenticated>
        <div className="text-center">
          <h1 className="text-4xl font-bold text-primary mb-4">NFC-e Web Crawler</h1>
          <p className="text-xl text-secondary mb-8">Sign in to manage your invoices</p>
          <div className="max-w-md mx-auto">
            <SignInForm />
          </div>
        </div>
      </Unauthenticated>
    </div>
  );
}

function InvoiceManager() {
  const [url, setUrl] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<Id<"nfce_links"> | null>(null);
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth()); // 0-11
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  
  const invoices = useQuery(api.nfce.listInvoices) || [];
  const addInvoice = useMutation(api.nfce.addInvoiceLink);
  const deleteInvoice = useMutation(api.nfce.deleteInvoice);
  const runCrawler = useAction(api.scraper.runCrawler);
  const selectedInvoiceData = useQuery(
    api.nfce.getInvoiceById,
    selectedInvoice ? { invoiceId: selectedInvoice } : "skip"
  );

  const handleAddInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    try {
      const newId = await addInvoice({ url: url.trim() });
      setUrl("");
      if (newId) {
        setSelectedInvoice(newId as Id<"nfce_links">);
      }
      toast.success("Invoice link added successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to add invoice");
    }
  };

  const handleRunCrawler = async () => {
    try {
      const result = await runCrawler({});
      toast.success(result.message);
    } catch (error: any) {
      toast.error(error.message || "Failed to run crawler");
    }
  };

  const handleDelete = async (invoiceId: Id<"nfce_links">) => {
    try {
      await deleteInvoice({ invoiceId });
      if (selectedInvoice === invoiceId) {
        setSelectedInvoice(null);
      }
      toast.success("Invoice deleted");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete invoice");
    }
  };

  const pendingCount = invoices.filter((inv) => inv.status === "pending").length;

  // Build available years from invoices with emission_ts
  const yearsAvailable = Array.from(
    new Set(
      invoices
        .map((inv: any) => (inv.emission_ts ? new Date(inv.emission_ts).getFullYear() : null))
        .filter((y: number | null): y is number => y !== null)
    )
  ).sort((a, b) => b - a);
  if (yearsAvailable.length === 0 || !yearsAvailable.includes(selectedYear)) {
    if (!yearsAvailable.includes(now.getFullYear())) yearsAvailable.push(now.getFullYear());
    yearsAvailable.sort((a, b) => b - a);
  }

  const filteredInvoices = invoices.filter((inv: any) => {
    if (!inv.emission_ts) return true; // Always include undated invoices to avoid omissions
    const d = new Date(inv.emission_ts);
    return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
  });

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-2xl font-bold mb-4">Add NFC-e Invoice</h2>
        <form
          onSubmit={(e) => {
            void handleAddInvoice(e);
          }}
          className="flex gap-2"
        >
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.fazenda.pr.gov.br/nfce/..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <button
            type="submit"
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Add
          </button>
        </form>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
          <h2 className="text-2xl font-bold">Invoices ({invoices.length})</h2>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm text-gray-600">Month</label>
            <select
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
            >
              {[
                "January","February","March","April","May","June","July","August","September","October","November","December",
              ].map((m, idx) => (
                <option key={idx} value={idx}>{m}</option>
              ))}
            </select>
            <label className="text-sm text-gray-600">Year</label>
            <select
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
            >
              {yearsAvailable.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <button
              onClick={() => {
                void handleRunCrawler();
              }}
              disabled={pendingCount === 0}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Process Pending ({pendingCount})
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {filteredInvoices.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No invoices yet. Add one above!</p>
            ) : (
              filteredInvoices.map((invoice) => (
                <div
                  key={invoice._id}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedInvoice === invoice._id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                  onClick={() => setSelectedInvoice(invoice._id)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        invoice.status === "done"
                          ? "bg-green-100 text-green-800"
                          : invoice.status === "error"
                          ? "bg-red-100 text-red-800"
                          : invoice.status === "processing"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {invoice.status}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleDelete(invoice._id);
                      }}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Delete
                    </button>
                  </div>
                  <p className="text-sm text-gray-600 truncate">{invoice.url}</p>
                  {invoice.last_run && (
                    <p className="text-xs text-gray-400 mt-1">
                      Last run: {new Date(invoice.last_run).toLocaleString()}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="border rounded-lg p-4 bg-gray-50">
            {selectedInvoiceData ? (
              <div>
                <h3 className="text-lg font-semibold mb-4">Invoice Details</h3>
                <div className="space-y-2 mb-4">
                  <p className="text-sm">
                    <span className="font-medium">Status:</span>{" "}
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        selectedInvoiceData.status === "done"
                          ? "bg-green-100 text-green-800"
                          : selectedInvoiceData.status === "error"
                          ? "bg-red-100 text-red-800"
                          : selectedInvoiceData.status === "processing"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {selectedInvoiceData.status}
                    </span>
                  </p>
                  <p className="text-sm break-all">
                    <span className="font-medium">URL:</span> {selectedInvoiceData.url}
                  </p>
                  {(selectedInvoiceData.total_amount_str || selectedInvoiceData.total_amount !== undefined) && (
                    <p className="text-sm">
                      <span className="font-medium">Total:</span>{" "}
                      {selectedInvoiceData.total_amount_str ??
                        new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                          selectedInvoiceData.total_amount || 0
                        )}
                    </p>
                  )}
                </div>

                {selectedInvoiceData.error_message && (
                  <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
                    <p className="text-sm text-red-800">
                      <span className="font-medium">Error:</span> {selectedInvoiceData.error_message}
                    </p>
                  </div>
                )}

                {selectedInvoiceData.extracted_data && selectedInvoiceData.extracted_data.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Extracted Items ({selectedInvoiceData.extracted_data.length})</h4>
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                      {selectedInvoiceData.extracted_data.map((item, idx) => (
                        <div key={idx} className="bg-white p-3 rounded border border-gray-200">
                          <p className="font-medium text-sm">{item.name}</p>
                          <div className="grid grid-cols-2 gap-2 mt-2 text-xs text-gray-600">
                            <p>Qty: {item.quantity} {item.unit}</p>
                            <p>Unit: {item.unit_price}</p>
                            <p className="col-span-2 font-medium">Total: {item.total_price}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">Select an invoice to view details</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
