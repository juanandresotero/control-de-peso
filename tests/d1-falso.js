// Imitación mínima de la base D1 de Cloudflare, solo con las 3 consultas que usa worker/index.js.
export function d1Falso() {
  const filas = new Map(); // id → { blob, v, updated }
  return {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              const fila = filas.get(args[0]);
              return fila ? { blob: fila.blob, v: fila.v } : null;
            },
            async run() {
              if (sql.startsWith("INSERT OR IGNORE")) {
                const [id, blob, updated] = args;
                if (filas.has(id)) return { meta: { changes: 0 } };
                filas.set(id, { blob, v: 1, updated });
                return { meta: { changes: 1 } };
              }
              if (sql.startsWith("UPDATE")) {
                const [blob, updated, id, base] = args;
                const fila = filas.get(id);
                if (!fila || fila.v !== base) return { meta: { changes: 0 } };
                filas.set(id, { blob, v: fila.v + 1, updated });
                return { meta: { changes: 1 } };
              }
              throw new Error("consulta no soportada: " + sql);
            },
          };
        },
      };
    },
  };
}
