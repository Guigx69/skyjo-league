type FormMessageProps = {
  type: "error" | "success" | "info";
  message: string;
};

export default function FormMessage({ type, message }: FormMessageProps) {
  const styles = {
    error: "border-red-500/30 bg-red-500/10 text-red-200",
    success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
    info: "border-blue-500/30 bg-blue-500/10 text-blue-200",
  };

  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${styles[type]}`}>
      {message}
    </div>
  );
}