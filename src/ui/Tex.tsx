import katex from 'katex'
import 'katex/dist/katex.min.css'

/** Renders a string with inline math written between $...$ */
export function Tex({ children }: { children: string }) {
  const parts = children.split(/(\$[^$]+\$)/g)
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('$') && p.endsWith('$') && p.length > 1 ? (
          <span key={i} dangerouslySetInnerHTML={{ __html: katex.renderToString(p.slice(1, -1), { throwOnError: false }) }} />
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  )
}
