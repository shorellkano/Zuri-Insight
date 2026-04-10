import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useListBrands } from "@workspace/api-client-react";

interface BrandContextType {
  activeBrandId: string | null;
  setActiveBrandId: (id: string | null) => void;
}

const BrandContext = createContext<BrandContextType>({
  activeBrandId: null,
  setActiveBrandId: () => {},
});

export function BrandProvider({ children }: { children: ReactNode }) {
  const [activeBrandId, setActiveBrandIdState] = useState<string | null>(() => {
    return localStorage.getItem("zuri_active_brand_id") ?? null;
  });

  const { data: brands } = useListBrands();

  useEffect(() => {
    if (brands && brands.length > 0 && !activeBrandId) {
      const first = brands[0].id;
      setActiveBrandIdState(first);
      localStorage.setItem("zuri_active_brand_id", first);
    }
  }, [brands, activeBrandId]);

  function setActiveBrandId(id: string | null) {
    setActiveBrandIdState(id);
    if (id) localStorage.setItem("zuri_active_brand_id", id);
    else localStorage.removeItem("zuri_active_brand_id");
  }

  return (
    <BrandContext.Provider value={{ activeBrandId, setActiveBrandId }}>
      {children}
    </BrandContext.Provider>
  );
}

export function useBrand() {
  return useContext(BrandContext);
}
