import { NextResponse } from "next/server";
import { getSkyjoRepository } from "@/lib/skyjoRepository";

export async function GET() {
  try {
    const repository = getSkyjoRepository();
    const dataset = await repository.getFullDataset();

    return NextResponse.json({
      data: dataset,
    });
  } catch (error) {
    console.error("[api/skyjo/dataset]", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erreur inconnue pendant le chargement du dataset Skyjo.",
      },
      {
        status: 500,
      }
    );
  }
}