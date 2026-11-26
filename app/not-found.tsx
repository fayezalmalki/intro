import { StatusPage, statusBtn } from "@/components/app/StatusPage";

/** Replaces Next's English 404 everywhere, including the signed-out redirect chain. */
export default function NotFound() {
  return (
    <StatusPage
      icon="search"
      ar={{ title: "ما لقينا هذي الصفحة", body: "يمكن الرابط قديم، أو الطلب اللي تدور عليه انحذف أو يخص حسابًا آخر." }}
      en={{ title: "We couldn't find that page", body: "The link may be old, or the request was removed or belongs to another account." }}
    >
      <a href="/home" className={`${statusBtn} bg-brand text-white hover:bg-brand-2`}>الرئيسية · Home</a>
      <a href="/search" className={`${statusBtn} bg-white text-ink outline outline-1 -outline-offset-1 outline-line`}>البحث · Search</a>
    </StatusPage>
  );
}
