import { ScrollView, StyleSheet, Text, View } from "react-native";
import { colors } from "~/features/theme";
import { type Block, parseMarkdown, parseSpans } from "./parseMarkdown";

const CHAR_WIDTH = 8;
const MIN_COLUMN = 64;
const MAX_COLUMN = 240;

function Inline({ text, style }: { text: string; style?: object }) {
  return (
    <Text style={[styles.text, style]} selectable>
      {parseSpans(text).map((span) => (
        <Text key={span.id} style={[span.bold && styles.bold, span.code && styles.code]}>
          {span.text}
        </Text>
      ))}
    </Text>
  );
}

function Table({ header, rows }: { header: string[]; rows: string[][] }) {
  // every row uses the same widths, so the columns line up
  const columns = header.map((title, id) => {
    const longest = Math.max(title.length, ...rows.map((row) => row[id]?.length ?? 0));
    return { id, width: Math.min(MAX_COLUMN, Math.max(MIN_COLUMN, longest * CHAR_WIDTH + 24)) };
  });
  const lines = [header, ...rows].map((cells, id) => ({ id, cells, head: id === 0 }));

  return (
    // wide tables scroll sideways instead of squeezing their columns
    <ScrollView horizontal style={styles.table} showsHorizontalScrollIndicator>
      <View>
        {lines.map(({ id, cells, head }) => (
          <View key={id} style={[styles.tableRow, head && styles.tableHead]}>
            {columns.map((column) => (
              <View key={column.id} style={[styles.cell, { width: column.width }]}>
                <Inline text={cells[column.id] ?? ""} style={head ? styles.bold : undefined} />
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case "heading":
      return <Inline text={block.text} style={styles.heading} />;
    case "paragraph":
      return <Inline text={block.text} />;
    case "list":
      return (
        <View style={styles.list}>
          {block.items.map((item) => (
            <View key={item.id} style={styles.listItem}>
              <Text style={[styles.text, styles.marker]}>{item.marker}</Text>
              <View style={styles.listText}>
                <Inline text={item.text} />
              </View>
            </View>
          ))}
        </View>
      );
    case "table":
      return <Table header={block.header} rows={block.rows} />;
  }
}

export function Markdown({ children }: { children: string }) {
  return (
    <View style={styles.blocks}>
      {parseMarkdown(children).map((block) => (
        <BlockView key={block.id} block={block} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  blocks: { gap: 10 },
  bold: { fontWeight: "700" },
  cell: { justifyContent: "center", paddingHorizontal: 10, paddingVertical: 8 },
  code: { backgroundColor: colors.surface, fontFamily: "Menlo" },
  heading: { fontSize: 17, fontWeight: "700" },
  list: { gap: 4 },
  listItem: { flexDirection: "row", gap: 8 },
  listText: { flex: 1 },
  marker: { color: colors.muted },
  // the border fits the table, and a table wider than the screen scrolls inside it
  table: {
    alignSelf: "flex-start",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flexGrow: 0,
    maxWidth: "100%",
  },
  tableHead: { backgroundColor: colors.surface },
  tableRow: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
  },
  text: { fontSize: 16, lineHeight: 23 },
});
