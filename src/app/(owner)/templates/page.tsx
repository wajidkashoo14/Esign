import Link from "next/link";
import { deleteTemplateAction } from "@/app/actions/templates";
import { IconDoc } from "@/components/Icons";
import { TemplateForm } from "@/components/TemplateForm";
import { db } from "@/lib/server/db";
import { extractVariables } from "@/lib/template";

export const metadata = { title: "Templates" };

export default async function Templates() {
  const templates = await db.template.findMany({ orderBy: { name: "asc" } });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Templates</h1>
        <p className="text-sm text-gray-500">Reusable agreement text. Use {"{{variables}}"} for the parts that change each time.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <ul className="space-y-3">
          {templates.map((t) => {
            const vars = extractVariables(`${t.title}\n${t.body}`);
            return (
              <li key={t.id} className="card flex flex-wrap items-center justify-between gap-3 !p-4">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="grid h-9 w-9 flex-none place-items-center rounded-lg bg-blue-50 text-blue-700">
                    <IconDoc />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{t.name}</p>
                    <p className="truncate text-sm text-gray-500">{t.title}</p>
                    {vars.length > 0 && <p className="mt-1 truncate font-mono text-[11px] text-gray-400">{vars.map((v) => `{{${v}}}`).join(" ")}</p>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link href={`/agreements/new?template=${t.id}`} className="btn btn-sm btn-primary">Use template</Link>
                  <form action={deleteTemplateAction}>
                    <input type="hidden" name="id" value={t.id} />
                    <button className="btn btn-sm btn-danger">Delete</button>
                  </form>
                </div>
              </li>
            );
          })}
          {!templates.length && (
            <li className="card py-10 text-center text-sm text-gray-500">No templates yet. Create one on the right.</li>
          )}
        </ul>
        <TemplateForm />
      </div>
    </div>
  );
}
