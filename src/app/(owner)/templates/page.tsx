import Link from "next/link";
import { deleteTemplateAction } from "@/app/actions/templates";
import { TemplateForm } from "@/components/TemplateForm";
import { db } from "@/lib/server/db";

export const metadata = { title: "Templates" };

export default async function Templates() {
  const templates = await db.template.findMany({ orderBy: { name: "asc" } });
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Templates</h1>
      <ul className="space-y-3">
        {templates.map((t) => (
          <li key={t.id} className="card flex items-center justify-between gap-3">
            <div>
              <p className="font-medium">{t.name}</p>
              <p className="text-sm text-gray-600">{t.title}</p>
            </div>
            <div className="flex gap-2">
              <Link href={`/agreements/new?template=${t.id}`} className="btn btn-sm btn-primary">Use</Link>
              <form action={deleteTemplateAction}>
                <input type="hidden" name="id" value={t.id} />
                <button className="btn btn-sm btn-danger">Delete</button>
              </form>
            </div>
          </li>
        ))}
        {!templates.length && <li className="text-sm text-gray-500">No templates yet.</li>}
      </ul>
      <TemplateForm />
    </div>
  );
}
