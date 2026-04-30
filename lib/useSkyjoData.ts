import { useEffect, useState } from "react";

export function useSkyjoData() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const stored = localStorage.getItem("skyjo_mapped_data");

    if (stored) {
      setData(JSON.parse(stored));
    }
  }, []);

  return data;
}