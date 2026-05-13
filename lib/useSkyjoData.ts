import { useEffect, useState } from "react";

export function useSkyjoData() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchDataset = async () => {
      try {
        setLoading(true);

        const response = await fetch("/api/skyjo/dataset", {
          method: "GET",
          cache: "no-store",
        });

        const result = await response.json();

        if (!response.ok) {
          console.error("Erreur récupération dataset Skyjo :", result?.error);
          if (!cancelled) setData(null);
          return;
        }

        if (!cancelled) {
          setData(result.data ?? null);
        }
      } catch (error) {
        console.error("Erreur récupération dataset Skyjo :", error);

        if (!cancelled) {
          setData(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchDataset();

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    data,
    loading,
    hasData: Boolean(data),
  };
}