const sanitizeHtml = require('sanitize-html');

/**
 * Sanitize rich text HTML to prevent Stored XSS while allowing safe formatting.
 * @param {string} dirtyHtml
 * @returns {string} cleanHtml
 */
function cleanHtml(dirtyHtml) {
    if (!dirtyHtml || typeof dirtyHtml !== 'string') return '';

    return sanitizeHtml(dirtyHtml, {
        allowedTags: [
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'p', 'a', 'ul', 'ol',
            'nl', 'li', 'b', 'i', 'strong', 'em', 'strike', 'code', 'hr', 'br', 'div',
            'table', 'thead', 'caption', 'tbody', 'tr', 'th', 'td', 'pre', 's', 'u', 'span',
            'img'
        ],
        allowedAttributes: {
            a: ['href', 'name', 'target', 'rel'],
            img: ['src', 'alt', 'title', 'width', 'height'],
            '*': ['style', 'class']
        },
        selfClosing: ['img', 'br', 'hr', 'input'],
        allowedSchemes: ['http', 'https', 'mailto', 'data'],
        transformTags: {
            'a': (tagName, attribs) => {
                const href = attribs.href || '';
                if (href.startsWith('http://') || href.startsWith('https://')) {
                    attribs.target = '_blank';
                    attribs.rel = 'noopener noreferrer';
                }
                return {
                    tagName: 'a',
                    attribs
                };
            }
        }
    });
}

module.exports = { cleanHtml };
