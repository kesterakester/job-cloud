
import { NextResponse } from 'next/server';
import { readPdfServer } from 'lib/parse-resume-from-pdf/read-pdf-server';
import { groupTextItemsIntoLines } from 'lib/parse-resume-from-pdf/group-text-items-into-lines';
import { groupLinesIntoSections } from 'lib/parse-resume-from-pdf/group-lines-into-sections';
import { extractResumeFromSections } from 'lib/parse-resume-from-pdf/extract-resume-from-sections';

// Helper to set CORS headers
function setCorsHeaders(res: NextResponse) {
    res.headers.set('Access-Control-Allow-Origin', '*'); // Allow all domains (or change to your specific frontend URL)
    res.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res;
}

export async function OPTIONS() {
    // Handle preflight OPTIONS request
    const response = NextResponse.json({}, { status: 200 });
    return setCorsHeaders(response);
}

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file');

        if (!file || !(file instanceof Blob)) {
            const errorResponse = NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
            return setCorsHeaders(errorResponse);
        }

        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        const textItems = await readPdfServer(uint8Array);
        const lines = groupTextItemsIntoLines(textItems);
        const sections = groupLinesIntoSections(lines);
        const resume = extractResumeFromSections(sections);

        const successResponse = NextResponse.json({ resume });
        return setCorsHeaders(successResponse);
    } catch (error) {
        console.error('Error parsing resume:', error);
        const errorResponse = NextResponse.json({ error: 'Failed to process resume' }, { status: 500 });
        return setCorsHeaders(errorResponse);
    }
}
