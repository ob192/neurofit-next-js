/**
 * Renders a schema.org graph into a <script type="application/ld+json">.
 *
 * `<` is escaped so a value that happened to contain `</script>` can't break
 * out of the tag. The data here is all first-party, but this stays correct if
 * user-supplied content is ever fed into the graph.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');

  return (
    <script
      type="application/ld+json"
      // The payload is serialised JSON, not markup — this is the documented
      // way to emit structured data in React.
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
