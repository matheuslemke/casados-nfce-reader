import { useMutation, useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { api } from "../convex/_generated/api";
import { MappingRulesComponent } from "./MappingRulesComponent";

interface CanonicalProductsPageProps {
  onBack: () => void;
}

type ViewMode = "list" | "create";
type SortField = "baseName" | "unit" | "createdAt";
type SortDirection = "asc" | "desc";

export function CanonicalProductsPage({ onBack }: CanonicalProductsPageProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortField>("baseName");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  
  // Create product form state
  const [newProductName, setNewProductName] = useState("");
  const [newProductUnit, setNewProductUnit] = useState("UNIT");
  const [newProductUnitDetail, setNewProductUnitDetail] = useState("");

  // Queries and mutations
  const canonicalProducts = useQuery(api.catalog.listCanonicalProducts) || [];
  const createCanonicalProduct = useMutation(api.catalog.createCanonicalProduct);

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    const filtered = canonicalProducts.filter(product =>
      product.baseName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.unit.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return filtered.sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortField) {
        case "baseName":
          aValue = a.baseName;
          bValue = b.baseName;
          break;
        case "unit":
          aValue = a.unit;
          bValue = b.unit;
          break;
        case "createdAt":
          aValue = a.createdAt;
          bValue = b.createdAt;
          break;
        default:
          aValue = a.baseName;
          bValue = b.baseName;
      }

      if (sortDirection === "asc") {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });
  }, [canonicalProducts, searchTerm, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handleCreateProduct = () => {
    if (!newProductName.trim()) {
      toast.error("Product name is required");
      return;
    }

    createCanonicalProduct({
      baseName: newProductName.trim(),
      unit: newProductUnit,
      unitDetail: newProductUnitDetail.trim() || undefined,
    })
      .then(() => {
        toast.success("Product created successfully");
        setNewProductName("");
        setNewProductUnit("UNIT");
        setNewProductUnitDetail("");
        setViewMode("list");
      })
      .catch((error) => {
        toast.error(`Failed to create product: ${error.message}`);
      });
  };

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return "N/A";
    return new Date(timestamp).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  if (viewMode === "create") {
    return (
      <div className="p-4 md:p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Create Canonical Product</h1>
            <p className="text-sm md:text-base text-gray-600 mt-1">
              Add a new canonical product to standardize item classification
            </p>
          </div>
          <button
            onClick={() => setViewMode("list")}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            ← Back to Products
          </button>
        </div>

        {/* Create Form */}
        <div className="bg-white rounded-lg shadow-sm border p-4 md:p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Product Name *
              </label>
              <input
                type="text"
                value={newProductName}
                onChange={(e) => setNewProductName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Ground Beef, Eggs, Milk"
              />
            </div>

            <div>
               <label className="block text-sm font-medium text-gray-700 mb-2">
                 Unit *
               </label>
               <input
                 type="text"
                 value={newProductUnit}
                 onChange={(e) => setNewProductUnit(e.target.value)}
                 className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                 placeholder="e.g., KG, UNIT, BOX, PACK, L, ML"
               />
             </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Unit Details (Optional)
              </label>
              <input
                type="text"
                value={newProductUnitDetail}
                onChange={(e) => setNewProductUnitDetail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., 500g package, 12-pack, etc."
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mt-6">
            <button
              onClick={handleCreateProduct}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Create Product
            </button>
            <button
              onClick={() => setViewMode("list")}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Canonical Products</h1>
          <p className="text-sm md:text-base text-gray-600 mt-1">
            Manage standardized product definitions for invoice item classification
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={() => setViewMode("create")}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            + Add Product
          </button>
          <button
            onClick={onBack}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            ← Back
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-sm border mb-6">
        <div className="p-4 md:p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th
                  className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("baseName")}
                >
                  Product Name
                  {sortField === "baseName" && (
                    <span className="ml-1">
                      {sortDirection === "asc" ? "↑" : "↓"}
                    </span>
                  )}
                </th>
                <th
                  className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 hidden sm:table-cell"
                  onClick={() => handleSort("unit")}
                >
                  Unit
                  {sortField === "unit" && (
                    <span className="ml-1">
                      {sortDirection === "asc" ? "↑" : "↓"}
                    </span>
                  )}
                </th>
                <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                  Unit Details
                </th>
                <th
                  className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 hidden lg:table-cell"
                  onClick={() => handleSort("createdAt")}
                >
                  Created
                  {sortField === "createdAt" && (
                    <span className="ml-1">
                      {sortDirection === "asc" ? "↑" : "↓"}
                    </span>
                  )}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredProducts.map((product) => (
                <tr key={product._id} className="hover:bg-gray-50">
                  <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {product.baseName}
                    </div>
                    <div className="text-sm text-gray-500 sm:hidden">
                      {product.unit}
                    </div>
                  </td>
                  <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-gray-900 hidden sm:table-cell">
                    {product.unit}
                  </td>
                  <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-gray-500 hidden md:table-cell">
                    {product.unitDetail || "-"}
                  </td>
                  <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-gray-500 hidden lg:table-cell">
                    {formatDate(product.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">
              {searchTerm ? "No products found matching your search." : "No canonical products yet."}
            </p>
            {!searchTerm && (
              <button
                onClick={() => setViewMode("create")}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Create your first product
              </button>
            )}
          </div>
        )}
      </div>

      {/* Mapping Rules Section */}
      <div className="mt-8">
        <MappingRulesComponent />
      </div>
    </div>
  );
}