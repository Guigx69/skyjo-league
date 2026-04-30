import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export function useSkyjoData() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDataset = async () => {
      const { data: row, error } = await supabase
        .from("skyjo_dataset")
        .select("data")
        .eq("id", "active")
        .maybeSingle();

      if (error) {
        console.error("Erreur récupération skyjo_dataset :", error);
        setLoading(false);
        return;
      }

      setData(row?.data ?? null);
      setLoading(false);
    };

    fetchDataset();
  }, []);

  return {
    data,
    loading,
    hasData: Boolean(data),
  };
}