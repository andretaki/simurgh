import postgres from "postgres";

type DropTarget = {
  schema: string;
  table: string;
};

const TARGETS: DropTarget[] = [
  // Drop children first.
  { schema: "simurgh", table: "po_line_items" },
  { schema: "simurgh", table: "po_history" },
  { schema: "simurgh", table: "rfq_to_po_mapping" },
  { schema: "simurgh", table: "invoices" },
  { schema: "simurgh", table: "purchase_orders" },
  { schema: "simurgh", table: "vendors" },
];

function parseArgs(argv: string[]) {
  const flags = new Set(argv);
  return {
    dryRun: flags.has("--dry-run"),
    force: flags.has("--force"),
  };
}

async function main() {
  const { dryRun, force } = parseArgs(process.argv.slice(2));

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  if (!force) {
    // This script is intentionally destructive. Require explicit opt-in.
    throw new Error(
      "Refusing to run without --force. Add --dry-run to preview or --force to execute.",
    );
  }

  const sql = postgres(process.env.DATABASE_URL, { prepare: false });

  try {
    const statements = TARGETS.map(
      (t) => `DROP TABLE IF EXISTS ${t.schema}.${t.table} CASCADE;`,
    );

    if (dryRun) {
      process.stdout.write(statements.join("\n") + "\n");
      return;
    }

    for (const stmt of statements) {
      await sql.unsafe(stmt);
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

