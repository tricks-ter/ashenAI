/**
 * Client-Side File & Document Intelligence Parser
 * Supports code files, text, markdown, CSV/TSV spreadsheets, JSON, and images.
 */

import { logger } from './logger';

export async function parseUploadedFile(file) {
  const fileInfo = {
    name: file.name,
    size: file.size,
    sizeFormatted: formatFileSize(file.size),
    type: file.type || 'text/plain',
    extension: file.name.split('.').pop().toLowerCase()
  };

  logger.info('SYSTEM', `Parsing uploaded file: ${file.name} (${fileInfo.sizeFormatted})`);

  // 1. Text & Code files
  const textExtensions = [
    'txt', 'md', 'json', 'csv', 'tsv', 'js', 'jsx', 'ts', 'tsx',
    'py', 'html', 'css', 'scss', 'yaml', 'yml', 'xml', 'sql',
    'sh', 'bash', 'env', 'rs', 'go', 'cpp', 'c', 'h', 'java'
  ];

  if (textExtensions.includes(fileInfo.extension) || file.type.startsWith('text/')) {
    try {
      const text = await readFileAsText(file);
      
      // If CSV/TSV, parse summary
      if (fileInfo.extension === 'csv' || fileInfo.extension === 'tsv') {
        const delimiter = fileInfo.extension === 'tsv' ? '\t' : ',';
        const lines = text.split('\n').filter(l => l.trim().length > 0);
        const headers = lines[0]?.split(delimiter) || [];
        
        return {
          ...fileInfo,
          category: 'spreadsheet',
          content: text,
          rowCount: lines.length,
          columnCount: headers.length,
          preview: `[Spreadsheet: ${file.name}] (${lines.length} rows, ${headers.length} columns: ${headers.slice(0, 8).join(', ')})`
        };
      }

      return {
        ...fileInfo,
        category: 'text_document',
        content: text,
        preview: text.slice(0, 300) + (text.length > 300 ? '...' : '')
      };
    } catch (err) {
      logger.error('SYSTEM', `Failed to read file ${file.name}: ${err.message}`);
      throw new Error(`Could not read ${file.name}: ${err.message}`);
    }
  }

  // 2. Images
  if (file.type.startsWith('image/')) {
    try {
      const dataUrl = await readFileAsDataURL(file);
      return {
        ...fileInfo,
        category: 'image',
        dataUrl,
        content: `[Image Attached: ${file.name} (${fileInfo.sizeFormatted})]`,
        preview: `[Image: ${file.name}]`
      };
    } catch (err) {
      throw new Error(`Could not process image ${file.name}`);
    }
  }

  // Fallback for other documents
  try {
    const text = await readFileAsText(file);
    return {
      ...fileInfo,
      category: 'generic_document',
      content: text,
      preview: `[File: ${file.name}]`
    };
  } catch (err) {
    return {
      ...fileInfo,
      category: 'binary_file',
      content: `[Binary File: ${file.name} (${fileInfo.sizeFormatted})]`,
      preview: `[Binary Attachment: ${file.name}]`
    };
  }
}

export function buildAttachmentsContext(files) {
  if (!files || files.length === 0) return '';

  let promptBlock = `\n\n=================================================================\n`;
  promptBlock += `[USER ATTACHED FILES & DOCUMENTS]\n`;
  promptBlock += `Attached Count: ${files.length} file(s)\n`;
  promptBlock += `=================================================================\n`;

  files.forEach((f, idx) => {
    promptBlock += `\n--- [Attachment ${idx + 1}: ${f.name} (${f.sizeFormatted}, Type: ${f.category})] ---\n`;
    if (f.category === 'spreadsheet') {
      promptBlock += `Rows: ${f.rowCount} | Columns: ${f.columnCount}\nDATA CONTENT:\n${f.content.slice(0, 10000)}\n`;
    } else if (f.category === 'image') {
      promptBlock += `[Image File: ${f.name}]\n`;
    } else {
      promptBlock += `${f.content.slice(0, 15000)}\n`;
    }
    promptBlock += `--- End of ${f.name} ---\n`;
  });

  promptBlock += `\n=================================================================\n`;
  promptBlock += `INSTRUCTIONS FOR ATTACHMENTS:\n`;
  promptBlock += `1. Analyze, parse, reference, and directly answer questions based on the attached files above.\n`;
  promptBlock += `2. If asked to modify, debug, or refactor code files, output the full updated code ready for the Live Workspace.\n`;
  promptBlock += `=================================================================\n\n`;

  return promptBlock;
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

