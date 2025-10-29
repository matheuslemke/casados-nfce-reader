import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { InvoiceItemWithDetails } from "../convex/invoiceItems";
import { toast } from "sonner";

interface InvoiceItemsTableProps {
  selectedMonth?: number;
  selectedYear?: number;
}

type SortField = "date" | "name" | "issuer" | "classification" | "totalPrice";
type SortDirection = "asc" | "desc";
type FilterType = "all" | "unassigned" | "assigned";

export function InvoiceItemsTable({ selectedMonth, selectedYear }: InvoiceItemsTableProps) {
  const [editingItemId, setEditingItemId] = useState<Id<"invoiceItems"> | null>(null);
  const [selectedCanonicalProductId, setSelectedCanonicalProductId] = useState<Id<"canonicalProducts"> | null>(null);
  
  // Search, filtering and sorting state
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [sortField, setSortField] = useState<SortField>(() => {
    const saved = localStorage.getItem("invoiceItemsSort");
    return saved ? JSON.parse(saved).field : "date";
  });
  const [sortDirection, setSortDirection] = useState<SortDirection>(() => {
    const saved = localStorage.getItem("invoiceItemsSort");
    return saved ? JSON.parse(saved).direction : "desc";
  });

  // Save sort preferences to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("invoiceItemsSort", JSON.stringify({
      field: sortField,
      direction: sortDirection
    }));
  }, [sortField, sortDirection]);

  // Fetch invoice items with details (now properly typed)
  const invoiceItemsQuery = useQuery(api.invoiceItems.listInvoiceItemsWithDetails, {
    month: selectedMonth,
    year: selectedYear,
  });
  const invoiceItems: InvoiceItemWithDetails[] = useMemo(() => invoiceItemsQuery || [], [invoiceItemsQuery]);

  // Fetch canonical products for dropdown
  const canonicalProductsQuery = useQuery(api.catalog.listCanonicalProducts);
  const canonicalProducts = useMemo(() => canonicalProductsQuery || [], [canonicalProductsQuery]);

  // Mutation to update canonical product assignment
  const updateItemCanonicalProduct = useMutation(api.invoiceItems.updateItemCanonicalProduct);

  // Filter and sort items
  const filteredAndSortedItems = useMemo(() => {
    // First, filter by search term
    let filtered = invoiceItems;
    
    // Apply search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(searchLower) ||
        (item.invoiceIssuer && item.invoiceIssuer.toLowerCase().includes(searchLower)) ||
        (item.canonicalProduct && item.canonicalProduct.baseName.toLowerCase().includes(searchLower))
      );
    }

    // Apply classification filter
    if (filterType === "unassigned") {
      filtered = filtered.filter(item => !item.canonicalProduct);
    } else if (filterType === "assigned") {
      filtered = filtered.filter(item => !!item.canonicalProduct);
    }

    // Then, sort the filtered results
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case "date": {
          const dateA = a.invoiceDate || 0;
          const dateB = b.invoiceDate || 0;
          comparison = dateA - dateB;
          break;
        }
        case "name": {
          comparison = a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
          break;
        }
        case "issuer": {
          const issuerA = a.invoiceIssuer || "";
          const issuerB = b.invoiceIssuer || "";
          comparison = issuerA.localeCompare(issuerB, 'pt-BR', { sensitivity: 'base' });
          break;
        }
        case "classification": {
          const classA = a.canonicalProduct ? a.canonicalProduct.baseName : "zzz_unassigned";
          const classB = b.canonicalProduct ? b.canonicalProduct.baseName : "zzz_unassigned";
          comparison = classA.localeCompare(classB, 'pt-BR', { sensitivity: 'base' });
          break;
        }
        case "totalPrice": {
          const priceA = a.numericTotalPrice || 0;
          const priceB = b.numericTotalPrice || 0;
          comparison = priceA - priceB;
          break;
        }
      }
      
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return sorted;
  }, [invoiceItems, searchTerm, filterType, sortField, sortDirection]);

  // Calculate statistics
  const statistics = useMemo(() => {
    const total = filteredAndSortedItems.length;
    const unassigned = filteredAndSortedItems.filter(item => !item.canonicalProduct).length;
    const assigned = total - unassigned;
    const totalValue = filteredAndSortedItems.reduce((sum, item) => sum + (item.numericTotalPrice || 0), 0);
    
    return { total, unassigned, assigned, totalValue };
  }, [filteredAndSortedItems]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // Set new field with ascending direction
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <span className="text-gray-400 ml-1">↕</span>;
    }
    return sortDirection === "asc" ? 
      <span className="text-blue-600 ml-1">↑</span> : 
      <span className="text-blue-600 ml-1">↓</span>;
  };

  const handleEditCanonicalProduct = (itemId: Id<"invoiceItems">, currentProductId?: Id<"canonicalProducts">) => {
    setEditingItemId(itemId);
    setSelectedCanonicalProductId(currentProductId || null);
  };

  const handleSaveCanonicalProduct = () => {
    if (!editingItemId) return;

    updateItemCanonicalProduct({
      itemId: editingItemId,
      canonicalProductId: selectedCanonicalProductId || undefined,
    })
      .then(() => {
        toast.success("Produto canônico atualizado com sucesso");
        setEditingItemId(null);
        setSelectedCanonicalProductId(null);
      })
      .catch((_error: Error) => {
        toast.error("Falha ao atualizar a atribuição do produto canônico");
      });
  };

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return "N/D";
    return new Date(timestamp).toLocaleDateString("pt-BR");
  };

  const formatCurrency = (value?: number, fallback?: string) => {
    if (value !== undefined) {
      return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(value);
    }
    return fallback || "N/D";
  };

  if (filteredAndSortedItems.length === 0) {
    return (
      <div className="space-y-6">
        {/* Filter Controls */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search Field */}
            <div>
              <label htmlFor="search-items" className="block text-sm font-medium text-gray-700 mb-2">
                Buscar Itens
              </label>
              <input
                id="search-items"
                type="text"
                placeholder="Buscar por nome do item, emissor ou produto canônico..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                aria-label="Buscar itens da nota fiscal"
              />
            </div>

            {/* Filter Type */}
            <div>
              <label htmlFor="filter-type" className="block text-sm font-medium text-gray-700 mb-2">
                Filtro de Classificação
              </label>
              <select
                id="filter-type"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as FilterType)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">Todos os Itens</option>
                <option value="unassigned">Apenas Não Atribuídos</option>
                <option value="assigned">Apenas Atribuídos</option>
              </select>
            </div>

            {/* Statistics */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Estatísticas
              </label>
              <div className="text-sm text-gray-600 space-y-1">
                <div>Total: {statistics.total} itens</div>
                <div>Não atribuídos: <span className="text-red-600 font-medium">{statistics.unassigned}</span></div>
                <div>Valor Total: {formatCurrency(statistics.totalValue)}</div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="text-center py-8 text-gray-500 bg-white rounded-lg shadow-sm border border-gray-200">
          <p>{searchTerm.trim() || filterType !== "all" ? "Nenhum item encontrado que corresponda aos seus critérios." : "Nenhum item de nota fiscal encontrado para o período selecionado."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter Controls */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search Field */}
          <div>
            <label htmlFor="search-items" className="block text-sm font-medium text-gray-700 mb-2">
              Buscar Itens
            </label>
            <input
              id="search-items"
              type="text"
              placeholder="Buscar por nome do item, emissor ou produto canônico..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              aria-label="Buscar itens da nota fiscal"
            />
          </div>

          {/* Filter Type */}
          <div>
            <label htmlFor="filter-type" className="block text-sm font-medium text-gray-700 mb-2">
              Filtro de Classificação
            </label>
            <select
              id="filter-type"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as FilterType)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">Todos os Itens</option>
              <option value="unassigned">Apenas Não Atribuídos</option>
              <option value="assigned">Apenas Atribuídos</option>
            </select>
          </div>

          {/* Statistics */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Estatísticas
            </label>
            <div className="text-sm text-gray-600 space-y-1">
              <div>Total: {statistics.total} itens</div>
              <div>Não atribuídos: <span className="text-red-600 font-medium">{statistics.unassigned}</span></div>
              <div>Valor Total: {formatCurrency(statistics.totalValue)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto shadow-lg rounded-lg">
        <table className="min-w-full bg-white border border-gray-200 rounded-lg">
          <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
            <tr>
              <th 
                className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b-2 border-gray-200 cursor-pointer hover:bg-gray-200 select-none transition-colors duration-200"
                onClick={() => handleSort("date")}
                role="button"
                tabIndex={0}
                aria-label={`Ordenar por data da nota fiscal ${sortField === "date" ? (sortDirection === "asc" ? "decrescente" : "crescente") : "crescente"}`}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleSort("date");
                  }
                }}
              >
                <div className="flex items-center justify-between">
                  <span>Data da Nota</span>
                  {getSortIcon("date")}
                </div>
              </th>
              <th 
                className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b-2 border-gray-200 cursor-pointer hover:bg-gray-200 select-none transition-colors duration-200"
                onClick={() => handleSort("issuer")}
                role="button"
                tabIndex={0}
                aria-label={`Ordenar por emissor ${sortField === "issuer" ? (sortDirection === "asc" ? "decrescente" : "crescente") : "crescente"}`}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleSort("issuer");
                  }
                }}
              >
                <div className="flex items-center justify-between">
                  <span>Emissor</span>
                  {getSortIcon("issuer")}
                </div>
              </th>
              <th 
                className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b-2 border-gray-200 cursor-pointer hover:bg-gray-200 select-none transition-colors duration-200"
                onClick={() => handleSort("name")}
                role="button"
                tabIndex={0}
                aria-label={`Ordenar por nome do item ${sortField === "name" ? (sortDirection === "asc" ? "decrescente" : "crescente") : "crescente"}`}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleSort("name");
                  }
                }}
              >
                <div className="flex items-center justify-between">
                  <span>Nome do Item</span>
                  {getSortIcon("name")}
                </div>
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b-2 border-gray-200">
                <span>Quantidade</span>
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b-2 border-gray-200">
                <span>Preço Unitário</span>
              </th>
              <th 
                className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b-2 border-gray-200 cursor-pointer hover:bg-gray-200 select-none transition-colors duration-200"
                onClick={() => handleSort("totalPrice")}
                role="button"
                tabIndex={0}
                aria-label={`Ordenar por preço total ${sortField === "totalPrice" ? (sortDirection === "asc" ? "decrescente" : "crescente") : "crescente"}`}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleSort("totalPrice");
                  }
                }}
              >
                <div className="flex items-center justify-between">
                  <span>Total do Item</span>
                  {getSortIcon("totalPrice")}
                </div>
              </th>
              <th 
                className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b-2 border-gray-200 cursor-pointer hover:bg-gray-200 select-none transition-colors duration-200"
                onClick={() => handleSort("classification")}
                role="button"
                tabIndex={0}
                aria-label={`Ordenar por classificação ${sortField === "classification" ? (sortDirection === "asc" ? "decrescente" : "crescente") : "crescente"}`}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleSort("classification");
                  }
                }}
              >
                <div className="flex items-center justify-between">
                  <span>Classificação</span>
                  {getSortIcon("classification")}
                </div>
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b-2 border-gray-200">
                <span>Produto Canônico</span>
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b-2 border-gray-200">
                <span>Unidade do Produto</span>
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b-2 border-gray-200">
                <span>Ações</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {filteredAndSortedItems.map((item, index) => (
            <tr key={item._id} className={`hover:bg-blue-50 transition-colors duration-200 border-l-4 ${index % 2 === 0 ? 'border-l-blue-200 bg-gray-50' : 'border-l-blue-300 bg-white'}`}>
              <td className="px-6 py-5 text-sm border-b border-gray-100">
                <div className="flex flex-col">
                  <span className="font-semibold text-gray-900">
                    {formatDate(item.invoiceDate)}
                  </span>
                  <span className="text-xs text-gray-500 mt-1">
                    Nota #{item.invoiceId?.toString().slice(-8)}
                  </span>
                </div>
              </td>
              <td className="px-6 py-5 text-sm border-b border-gray-100">
                <div className="flex flex-col">
                  <div className="max-w-32 truncate font-semibold text-gray-800" title={item.invoiceIssuer || "N/D"}>
                    {item.invoiceIssuer || "N/D"}
                  </div>
                  <span className="text-xs text-gray-500 mt-1">Loja</span>
                </div>
              </td>
              <td className="px-6 py-5 text-sm border-b border-gray-100">
                <div className="flex flex-col">
                  <div className="max-w-72 font-bold text-gray-900 leading-tight" title={item.name}>
                    {item.name}
                  </div>
                  <span className="text-xs text-gray-500 mt-1">Produto</span>
                </div>
              </td>
              <td className="px-6 py-5 text-sm border-b border-gray-100">
                <div className="flex flex-col items-start">
                  <div className="flex items-baseline gap-1">
                    <span className="font-bold text-lg text-gray-900">{item.quantity}</span>
                    <span className="text-sm text-gray-600 font-medium">{item.unit}</span>
                  </div>
                  <span className="text-xs text-gray-500 mt-1">Qtd</span>
                </div>
              </td>
              <td className="px-6 py-5 text-sm border-b border-gray-100">
                <div className="flex flex-col">
                  <span className="font-bold text-gray-900">
                    {formatCurrency(item.numericUnitPrice, item.unit_price)}
                  </span>
                  <span className="text-xs text-gray-500 mt-1">Por unidade</span>
                </div>
              </td>
              <td className="px-6 py-5 text-sm border-b border-gray-100">
                <div className="flex flex-col">
                  <span className="font-bold text-lg text-green-700">
                    {formatCurrency(item.numericTotalPrice, item.total_price)}
                  </span>
                  <span className="text-xs text-gray-500 mt-1">Total</span>
                </div>
              </td>
              <td className="px-6 py-5 text-sm border-b border-gray-100">
                <div className="flex flex-col">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    item.canonicalProductId 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {item.canonicalProductId ? 'Atribuído' : 'Não Atribuído'}
                  </span>
                  <span className="text-xs text-gray-500 mt-1">Status</span>
                </div>
              </td>
              <td className="px-4 py-4 text-sm text-gray-900 border-b">
                {editingItemId === item._id ? (
                  <div className="flex flex-col gap-2">
                    <select
                      value={selectedCanonicalProductId || ""}
                      onChange={(e) => setSelectedCanonicalProductId(e.target.value as Id<"canonicalProducts"> || null)}
                      className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Nenhum produto canônico</option>
                      {canonicalProducts.map((product) => (
                        <option key={product._id} value={product._id}>
                          {product.baseName} ({product.unit})
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleSaveCanonicalProduct()}
                        className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                      >
                        Salvar
                      </button>
                      <button
                        onClick={() => setEditingItemId(null)}
                        className="text-xs bg-gray-500 text-white px-2 py-1 rounded hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center">
                    {item.canonicalProduct ? (
                      <div className="flex flex-col">
                        <span className="font-medium text-blue-700">
                          {item.canonicalProduct.baseName}
                        </span>
                        <span className="text-xs text-gray-500">
                          Atribuído
                        </span>
                      </div>
                    ) : (
                      <span className="text-gray-400 italic">Não atribuído</span>
                    )}
                  </div>
                )}
              </td>
              <td className="px-4 py-4 text-sm text-gray-900 border-b">
                {item.canonicalProduct ? (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {item.canonicalProduct.unit}
                  </span>
                ) : (
                  <span className="text-gray-400 text-xs">-</span>
                )}
              </td>
              <td className="px-4 py-4 text-sm border-b">
                {editingItemId !== item._id && (
                  <button
                    onClick={() => handleEditCanonicalProduct(item._id, item.canonicalProductId)}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium focus:outline-none focus:underline"
                  >
                    {item.canonicalProduct ? "Alterar" : "Atribuir"}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
  );
}