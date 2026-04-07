export default function PageSpinner() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-border-light border-t-charcoal" />
    </div>
  );
}
