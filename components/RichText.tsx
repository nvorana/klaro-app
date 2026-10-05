// Renders the ebook writer's **bold** insight lines as bold text.
// Stray markers (an unclosed **) are dropped so asterisks never reach the
// reader. Newlines are left to the parent's `whitespace-pre-line`.
export function RichText({ text }: { text?: string | null }) {
  if (!text) return null
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, i) =>
        /^\*\*[^*]+\*\*$/.test(part)
          ? <strong key={i} className="font-semibold text-[#1A1F36]">{part.slice(2, -2)}</strong>
          : part.replace(/\*\*/g, ''),
      )}
    </>
  )
}
