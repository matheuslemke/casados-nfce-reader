import {
  Authenticated,
  Unauthenticated,
  useQuery,
  useMutation,
  useAction,
} from "convex/react";
import { api } from "../convex/_generated/api";
import { SignInForm } from "./SignInForm";
import { SignOutButton } from "./SignOutButton";
import { Management } from "./Management";
import { CanonicalProductsPage } from "./CanonicalProductsPage";
import { Toaster, toast } from "sonner";
import { useState } from "react";
import { Id } from "../convex/_generated/dataModel";

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<"home" | "management" | "products">("home");

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm h-16 flex justify-between items-center border-b shadow-sm px-4">
        <div className="flex items-center gap-6">
          <h2 className="text-xl font-semibold text-primary">NFC-e Crawler</h2>
          <nav className="flex gap-4">
            <button
              onClick={() => setCurrentScreen("home")}
              className={`px-3 py-1 rounded transition-colors ${
                currentScreen === "home"
                  ? "bg-blue-600 text-white"
                  : "text-gray-600 hover:text-blue-600"
              }`}
            >
              Início
            </button>
            <button
              onClick={() => setCurrentScreen("management")}
              className={`px-3 py-1 rounded transition-colors ${
                currentScreen === "management"
                  ? "bg-blue-600 text-white"
                  : "text-gray-600 hover:text-blue-600"
              }`}
            >
              Gerenciamento
            </button>
            <button
              onClick={() => setCurrentScreen("products")}
              className={`px-3 py-1 rounded transition-colors ${
                currentScreen === "products"
                  ? "bg-blue-600 text-white"
                  : "text-gray-600 hover:text-blue-600"
              }`}
            >
              Produtos
            </button>
          </nav>
        </div>
        <SignOutButton />
      </header>
      <main className="flex-1 p-8">
        <div className="w-full max-w-6xl mx-auto">
          <Content currentScreen={currentScreen} setCurrentScreen={setCurrentScreen} />
        </div>
      </main>
      <Toaster />
    </div>
  );
}

function Content({ 
  currentScreen, 
  setCurrentScreen 
}: { 
  currentScreen: "home" | "management" | "products";
  setCurrentScreen: (screen: "home" | "management" | "products") => void;
}) {
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
        {currentScreen === "home" ? (
          <InvoiceManager />
        ) : currentScreen === "management" ? (
          <Management />
        ) : (
          <CanonicalProductsPage onBack={() => setCurrentScreen("home")} />
        )}
      </Authenticated>
      <Unauthenticated>
        <div className="text-center">
          <h1 className="text-4xl font-bold text-primary mb-4">
            NFC-e Web Crawler
          </h1>
          <p className="text-xl text-secondary mb-8">
            Faça login para gerenciar suas notas fiscais
          </p>
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
  const [bulkInput, setBulkInput] = useState("");
  const [selectedInvoice, setSelectedInvoice] =
    useState<Id<"nfce_links"> | null>(null);
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1); // 1-12
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());

  const invoices = useQuery(api.nfce.listInvoices) || [];
  const addInvoice = useMutation(api.nfce.addInvoiceLink);
  const addInvoiceBulk = useMutation(api.nfce.addInvoiceLinksBulk);
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
      toast.success("Link da nota fiscal adicionado com sucesso");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Falha ao adicionar nota fiscal");
    }
  };

  const handleRunCrawler = async () => {
    try {
      const result = await runCrawler({});
      toast.success(`Crawler concluído: ${result.count} processados`);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Falha ao executar crawler");
    }
  };

  const handleBulkImport = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = bulkInput.trim();
    if (!raw) {
      toast.error("Nenhuma URL encontrada. Cole links separados por TAB.");
      return;
    }
    // Split by tabs or newlines, trim, drop empties, strip quotes/backticks
    const parts = raw
      .split(/[\t\n\r]+/)
      .map((s) => s.replace(/[`'"“”‘’]/g, "").trim())
      .filter(Boolean);
    // Deduplicate while preserving order
    const seen = new Set<string>();
    const urls: string[] = [];
    for (const p of parts) {
      if (!seen.has(p)) {
        seen.add(p);
        urls.push(p);
      }
    }
    if (urls.length === 0) {
      toast.error("Nenhuma URL válida após análise.");
      return;
    }

    try {
      const result = await addInvoiceBulk({ urls });
      const { successCount, errorCount, results } = result || {
        successCount: 0,
        errorCount: 0,
        results: [],
      };
      if (successCount > 0) {
        toast.success(
          `Imported ${successCount} link${successCount > 1 ? "s" : ""}.`
        );
        setBulkInput("");
        // Select the first created invoice for quick access
        const first = (results || []).find((r) => r.ok);
        if (first && first.id) {
          setSelectedInvoice(first.id);
        }
      }
      if (errorCount > 0) {
        const errors = (results || []).filter((r) => !r.ok).slice(0, 5);
        const details = errors
          .map((e) => `${e.url || "(empty)"} - ${e.error}`)
          .join("\n");
        toast.error(
          `Rejected ${errorCount} link${errorCount > 1 ? "s" : ""}.\n${details}${errorCount > errors.length ? "\n..." : ""}`
        );
      }
    } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : "Importação em lote falhou");
      }
  };

  const handleDelete = async (invoiceId: Id<"nfce_links">) => {
    try {
      await deleteInvoice({ invoiceId });
      if (selectedInvoice === invoiceId) {
        setSelectedInvoice(null);
      }
      toast.success("Nota fiscal excluída");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Falha ao excluir nota fiscal");
    }
  };

  const pendingCount = invoices.filter(
    (inv) => inv.status === "pending"
  ).length;

  // Build available years from invoices with emission_ts
  const yearsAvailable = Array.from(
    new Set(
      (invoices as Invoice[])
        .map((inv) =>
          inv.emission_ts ? new Date(inv.emission_ts).getFullYear() : null
        )
        .filter((y: number | null): y is number => y !== null)
    )
  ).sort((a, b) => b - a);
  if (yearsAvailable.length === 0 || !yearsAvailable.includes(selectedYear)) {
    if (!yearsAvailable.includes(now.getFullYear()))
      yearsAvailable.push(now.getFullYear());
    yearsAvailable.sort((a, b) => b - a);
  }

  const filteredInvoices = (invoices as Invoice[]).filter((inv) => {
    if (!inv.emission_ts) return true; // Always include undated invoices to avoid omissions
    const d = new Date(inv.emission_ts);
    return d.getMonth() + 1 === selectedMonth && d.getFullYear() === selectedYear;
  });

  const sortedInvoices = [...filteredInvoices].sort((a, b) => {
    const at =
      typeof a.emission_ts === "number"
        ? a.emission_ts
        : Number.POSITIVE_INFINITY;
    const bt =
      typeof b.emission_ts === "number"
        ? b.emission_ts
        : Number.POSITIVE_INFINITY;
    return at - bt;
  });

  // Calculate current month total across all invoices regardless of status
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const startOfNextMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    1
  ).getTime();
  const currentMonthInvoices = (invoices as Invoice[]).filter(
    (inv) =>
      typeof inv.emission_ts === "number" &&
      inv.emission_ts >= startOfMonth &&
      inv.emission_ts < startOfNextMonth
  );
  const currentMonthTotal = currentMonthInvoices.reduce(
    (sum: number, inv) =>
      sum + (typeof inv.total_amount === "number" ? inv.total_amount : 0),
    0
  );
  const currentMonthLabel = new Date(
    now.getFullYear(),
    now.getMonth(),
    1
  ).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-2xl font-bold mb-4">Adicionar Nota Fiscal NFC-e</h2>
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
            Adicionar
          </button>
        </form>
        <form
          onSubmit={(e) => {
            void handleBulkImport(e);
          }}
          className="mt-4 border-t pt-4 space-y-2"
        >
          <label className="block text-sm text-gray-700 font-medium">
            Importação em lote (cole links separados por TAB)
          </label>
          <textarea
            value={bulkInput}
            onChange={(e) => setBulkInput(e.target.value)}
            placeholder={"url1\turl2\turl3 ou uma por linha"}
            className="w-full h-28 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">
              Formato: links separados por TABs ou novas linhas
            </span>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Importar
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
          <h2 className="text-2xl font-bold">
            Notas Fiscais ({sortedInvoices.length})
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm text-gray-600">Mês</label>
            <select
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
            >
              {[
                "Janeiro",
                "Fevereiro",
                "Março",
                "Abril",
                "Maio",
                "Junho",
                "Julho",
                "Agosto",
                "Setembro",
                "Outubro",
                "Novembro",
                "Dezembro",
              ].map((m, idx) => (
                <option key={idx} value={idx + 1}>
                  {m}
                </option>
              ))}
            </select>
            <label className="text-sm text-gray-600">Ano</label>
            <select
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
            >
              {yearsAvailable.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                void handleRunCrawler();
              }}
              disabled={pendingCount === 0}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Processar Pendentes ({pendingCount})
            </button>
          </div>
        </div>

        <div className="mb-4 text-sm">
          <span className="font-medium">Total para {currentMonthLabel}:</span>{" "}
          {new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
          }).format(currentMonthTotal)}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {sortedInvoices.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                Nenhuma nota fiscal ainda. Adicione uma acima!
              </p>
            ) : (
              sortedInvoices.map((invoice) => (
                <div
                  key={invoice._id}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedInvoice === invoice._id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                  onClick={() => setSelectedInvoice(invoice._id)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-700">
                        {typeof invoice.emission_ts === "number"
                          ? new Date(invoice.emission_ts).toLocaleDateString(
                              "pt-BR"
                            )
                          : "Sem data"}
                      </span>
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
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleDelete(invoice._id);
                      }}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Excluir
                    </button>
                  </div>
                  <div className="mb-2 text-sm text-gray-700">
                    {invoice.issuer ?? "-"}
                  </div>
                  {(invoice.total_amount_str ||
                    invoice.total_amount !== undefined) && (
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Total:</span>{" "}
                      {invoice.total_amount_str ??
                        new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        }).format(invoice.total_amount || 0)}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="border rounded-lg p-4 bg-gray-50">
            {selectedInvoiceData ? (
              <div>
                <h3 className="text-lg font-semibold mb-4">Detalhes da Nota Fiscal</h3>
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
                    <span className="font-medium">URL:</span>{" "}
                    {selectedInvoiceData.url}
                  </p>
                  {selectedInvoiceData.issuer && (
                    <p className="text-sm">
                      <span className="font-medium">Emissor:</span>{" "}
                      {selectedInvoiceData.issuer}
                    </p>
                  )}
                  {(selectedInvoiceData.total_amount_str ||
                    selectedInvoiceData.total_amount !== undefined) && (
                    <p className="text-sm">
                      <span className="font-medium">Total:</span>{" "}
                      {selectedInvoiceData.total_amount_str ??
                        new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        }).format(selectedInvoiceData.total_amount || 0)}
                    </p>
                  )}
                </div>

                {selectedInvoiceData.error_message && (
                  <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
                    <p className="text-sm text-red-800">
                      <span className="font-medium">Error:</span>{" "}
                      {selectedInvoiceData.error_message}
                    </p>
                  </div>
                )}

                {selectedInvoiceData.extracted_data &&
                  selectedInvoiceData.extracted_data.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">
                        Itens Extraídos (
                        {selectedInvoiceData.extracted_data.length})
                      </h4>
                      <div className="space-y-2 max-h-[400px] overflow-y-auto">
                        {selectedInvoiceData.extracted_data.map((item, idx) => (
                          <div
                            key={idx}
                            className="bg-white p-3 rounded border border-gray-200"
                          >
                            <p className="font-medium text-sm">{item.name}</p>
                            <div className="grid grid-cols-2 gap-2 mt-2 text-xs text-gray-600">
                              <p>
                                Qtd: {item.quantity} {item.unit}
                              </p>
                              <p>Unitário: {item.unit_price}</p>
                              <p className="col-span-2 font-medium">
                                Total: {item.total_price}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">
                Selecione uma nota fiscal para ver os detalhes
              </p>
            )}
          </div>
        </div>
      </div>


    </div>
  );
}

interface Invoice {
  _id: Id<"nfce_links">;
  url: string;
  status: string;
  emission_ts?: number;
  issuer?: string;
  total_amount?: number;
  total_amount_str?: string;
}
