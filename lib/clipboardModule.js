// lib/clipboardModule.js

// Import displayMessage from script.js for user feedback
import { displayMessage, showSpinner, hideSpinner } from './script.js';

/**
 * Helper function to convert a Data URL (Base64) to a Blob object.
 * Required for the modern Clipboard API.
 * @param {string} dataurl - The data URL string (e.g., 'data:image/png;base64,...').
 * @returns {Blob} The Blob object representing the image.
 */
function dataURLtoBlob(dataurl) {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
}

/**
 * Copies an HTML element (like a table) as an image to the clipboard.
 * Uses html2canvas to render the HTML to a canvas, then copies the canvas image.
 * @param {string} elementId - The ID of the HTML element to copy.
 * @param {string} buttonId - The ID of the button triggering the copy.
 * @param {string} buttonTextId - The ID of the button's text span.
 * @param {string} spinnerId - The ID of the button's spinner.
 */
async function copyHtmlElementAsImage(elementId, buttonId, buttonTextId, spinnerId) {
    showSpinner(buttonId, spinnerId, buttonTextId);
    const elementToCopy = document.getElementById(elementId);

    if (!elementToCopy) {
        displayMessage(`Error: Element with ID '${elementId}' not found for copying.`, true, 'modal');
        hideSpinner(buttonId, spinnerId, buttonTextId);
        return;
    }

    try {
        // Use html2canvas to render the HTML element to a canvas
        const canvas = await html2canvas(elementToCopy, {
            scale: 2, // Render at 2x resolution for better quality
            backgroundColor: '#1a1a1c', // Match your app's background for consistency
            useCORS: true // Important if your HTML includes images from other domains
        });

        // Convert canvas to Blob
        canvas.toBlob(async (blob) => {
            if (!blob) {
                displayMessage('Failed to create image blob from canvas.', true, 'modal');
                hideSpinner(buttonId, spinnerId, buttonTextId);
                return;
            }

            // Use the modern Clipboard API
            if (navigator.clipboard && navigator.clipboard.write) {
                const item = new ClipboardItem({ "image/png": blob });
                try {
                    await navigator.clipboard.write([item]);
                    displayMessage('Table image copied to clipboard!', false, 'modal');
                    console.log('Table image copied to clipboard!');
                } catch (err) {
                    displayMessage(`Failed to copy table image to clipboard: ${err.message}`, true, 'modal');
                    console.error('Failed to copy table image:', err);
                }
            } else {
                displayMessage('Clipboard API not supported or restricted by browser. Please try manually copying.', true, 'modal');
                console.warn('Clipboard API not supported or restricted.');
            }
            hideSpinner(buttonId, spinnerId, buttonTextId);
        }, 'image/png');

    } catch (error) {
        displayMessage(`Error rendering element to image: ${error.message}`, true, 'modal');
        console.error('Error rendering HTML element to image:', error);
        hideSpinner(buttonId, spinnerId, buttonTextId);
    }
}

/**
 * Copies a Chart.js canvas as an image to the clipboard.
 * @param {string} canvasId - The ID of the canvas element (e.g., 'utilizationChart').
 * @param {string} buttonId - The ID of the button triggering the copy.
 * @param {string} buttonTextId - The ID of the button's text span.
 * @param {string} spinnerId - The ID of the button's spinner.
 */
async function copyChartAsImage(canvasId, buttonId, buttonTextId, spinnerId) {
    showSpinner(buttonId, spinnerId, buttonTextId);
    const chartCanvas = document.getElementById(canvasId);

    if (!chartCanvas || !(chartCanvas instanceof HTMLCanvasElement)) {
        displayMessage(`Error: Canvas element with ID '${canvasId}' not found or is not a canvas.`, true, 'modal');
        hideSpinner(buttonId, spinnerId, buttonTextId);
        return;
    }

    try {
        const imageDataURL = chartCanvas.toDataURL('image/png', 1.0); // 1.0 for max quality
        const blob = dataURLtoBlob(imageDataURL);

        // Use the modern Clipboard API
        if (navigator.clipboard && navigator.clipboard.write) {
            const item = new ClipboardItem({ "image/png": blob });
            try {
                await navigator.clipboard.write([item]);
                displayMessage('Graph image copied to clipboard!', false, 'modal');
                console.log('Graph image copied to clipboard!');
            } catch (err) {
                displayMessage(`Failed to copy graph image to clipboard: ${err.message}`, true, 'modal');
                console.error('Failed to copy graph image:', err);
            }
        } else {
            displayMessage('Clipboard API not supported or restricted by browser. Please try manually copying.', true, 'modal');
            console.warn('Clipboard API not supported or restricted.');
        }
    } catch (error) {
        displayMessage(`Error copying chart image: ${error.message}`, true, 'modal');
        console.error('Error copying chart image:', error);
    } finally {
        hideSpinner(buttonId, spinnerId, buttonTextId);
    }
}

// Event Listeners for the new buttons
document.addEventListener('DOMContentLoaded', () => {
    const copyTableBtn = document.getElementById('copyTableBtn');
    const copyChartBtn = document.getElementById('copyChartBtn');

    if (copyTableBtn) {
        copyTableBtn.addEventListener('click', () => {
            copyHtmlElementAsImage('dataContainer', 'copyTableBtn', 'copyTableBtnText', 'copyTableSpinner');
        });
    } else {
        console.warn('Copy Table button not found.');
    }

    if (copyChartBtn) {
        copyChartBtn.addEventListener('click', () => {
            copyChartAsImage('utilizationChart', 'copyChartBtn', 'copyChartBtnText', 'copyChartSpinner');
        });
    } else {
        console.warn('Copy Chart button not found.');
    }
});
