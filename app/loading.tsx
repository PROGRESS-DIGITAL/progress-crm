import { LoadingBar } from "@/components/loading-bar";

// Пока раздел загружается, вместо пустой страницы — полоса загрузки
export default function Loading() {
  return <LoadingBar className="flex-1" />;
}
