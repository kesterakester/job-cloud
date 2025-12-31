
import * as pdfjs from "pdfjs-dist";
import type { TextItem as PdfjsTextItem } from "pdfjs-dist/types/src/display/api";
import type { TextItem, TextItems } from "./types";

/**
 * Server-side version of readPdf.
 * Accepts ArrayBuffer/Uint8Array instead of file URL.
 * Does not set workerSrc (relies on Node.js environment).
 */
export const readPdfServer = async (data: ArrayBuffer | Uint8Array): Promise<TextItems> => {
    const pdfFile = await pdfjs.getDocument(data).promise;
    let textItems: TextItems = [];

    for (let i = 1; i <= pdfFile.numPages; i++) {
        // Parse each page into text content
        const page = await pdfFile.getPage(i);
        const textContent = await page.getTextContent();

        // Wait for font data to be loaded
        await page.getOperatorList();
        const commonObjs = page.commonObjs;

        // Convert Pdfjs TextItem type to new TextItem type
        const pageTextItems = textContent.items.map((item) => {
            const {
                str: text,
                dir, // Remove text direction
                transform,
                fontName: pdfFontName,
                ...otherProps
            } = item as PdfjsTextItem;

            // Extract x, y position of text item from transform.
            const x = transform[4];
            const y = transform[5];

            // Use commonObjs to convert font name to original name
            const fontObj = commonObjs.get(pdfFontName);
            const fontName = fontObj.name;

            // pdfjs reads a "-" as "-­‐" in the resume example. This is to revert it.
            const newText = text.replace(/-­‐/g, "-");

            const newItem: TextItem = {
                ...otherProps,
                fontName,
                text: newText,
                x,
                y,
                // Ensure properties match valid TextItem interface (if strict)
                // width/height/hasEOL are usually in otherProps from pdfjs
                width: otherProps.width,
                height: otherProps.height,
                hasEOL: otherProps.hasEOL,
            };
            return newItem;
        });

        textItems.push(...pageTextItems);
    }

    // Filter out empty space textItem noise
    const isEmptySpace = (textItem: TextItem) =>
        !textItem.hasEOL && textItem.text.trim() === "";
    return textItems.filter((textItem) => !isEmptySpace(textItem));
};
