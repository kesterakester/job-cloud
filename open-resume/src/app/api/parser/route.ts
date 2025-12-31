
import { NextResponse } from 'next/server';
import { readPdfServer } from 'lib/parse-resume-from-pdf/read-pdf-server';
import { groupTextItemsIntoLines } from 'lib/parse-resume-from-pdf/group-text-items-into-lines';
import { groupLinesIntoSections } from 'lib/parse-resume-from-pdf/group-lines-into-sections';
import { extractResumeFromSections } from 'lib/parse-resume-from-pdf/extract-resume-from-sections';

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file');

        if (!file || !(file instanceof Blob)) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        const textItems = await readPdfServer(uint8Array);
        const lines = groupTextItemsIntoLines(textItems);
        const sections = groupLinesIntoSections(lines);
        const resume = extractResumeFromSections(sections);

        return NextResponse.json({ resume });
    } catch (error) {
        console.error('Error parsing resume:', error);
        return NextResponse.json({ error: 'Failed to process resume' }, { status: 500 });
    }
}
