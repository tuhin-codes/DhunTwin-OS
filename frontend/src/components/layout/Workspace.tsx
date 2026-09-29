import AppRoutes from "../../routes/AppRoutes";

export default function Workspace() {
  return (
    <main
      className="
        min-w-0
        flex-1
        overflow-y-auto
        bg-[#F5F8F6]
        scrollbar-thin
      "
    >
      <div className="min-h-full w-full">
        <AppRoutes />
      </div>
    </main>
  );
}