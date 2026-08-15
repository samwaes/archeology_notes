import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/current-user";
import { createRecordLink, removeRecordLink, type RecordRelationshipType } from "@/lib/record-evidence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function relationshipType(value: unknown): RecordRelationshipType {
  const type = typeof value === "string" ? value : "related";
  return type as RecordRelationshipType;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireCurrentUser();
  try {
    const { id } = await params;
    const body = await request.json() as Record<string, unknown>;
    const targetRecordId = typeof body.targetRecordId === "string" ? body.targetRecordId.trim() : "";
    if (!targetRecordId) return NextResponse.json({ error: "Choose a record to link." }, { status: 400 });
    await createRecordLink({
      recordId: id,
      targetRecordId,
      relationshipType: relationshipType(body.relationshipType),
      actorId: user.localUserId
    });
    revalidatePath(`/records/${id}`);
    revalidatePath(`/records/${id}/edit`);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not link the record.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireCurrentUser();
  try {
    const { id } = await params;
    const body = await request.json() as Record<string, unknown>;
    const targetRecordId = typeof body.targetRecordId === "string" ? body.targetRecordId.trim() : "";
    if (!targetRecordId) return NextResponse.json({ error: "Linked record is required." }, { status: 400 });
    await removeRecordLink({
      recordId: id,
      targetRecordId,
      relationshipType: relationshipType(body.relationshipType),
      actorId: user.localUserId
    });
    revalidatePath(`/records/${id}`);
    revalidatePath(`/records/${id}/edit`);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not remove the link.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
