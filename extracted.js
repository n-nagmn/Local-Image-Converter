
        const fileInput = document.getElementById('fileInput');
        const emptyState = document.getElementById('emptyState');
        const fileListContainer = document.getElementById('fileListContainer');
        const fileItems = document.getElementById('fileItems');
        const convertBtn = document.getElementById('convertBtn');
        const zipBtn = document.getElementById('zipBtn');
        const qualityRange = document.getElementById('qualityRange');
        const qualityDisplay = document.getElementById('qualityDisplay');

        let filesData = [];

        function esc(s) {
            return String(s)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
        }

        const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|avif|bmp|gif|ico|heic|heif|tiff?|svg)$/i;

        function isImageFile(file) {
            return (file.type && file.type.startsWith('image/')) || IMAGE_EXTENSIONS.test(file.name);
        }

        qualityRange.addEventListener('input', e => {
            qualityDisplay.textContent = e.target.value;
        });

        window.addEventListener('dragenter', e => {
            e.preventDefault();
        });

        window.addEventListener('dragover', e => {
            e.preventDefault();
            if (emptyState.style.display !== 'none') {
                emptyState.style.backgroundColor = '#f0f0f0';
            }
        });

        window.addEventListener('dragleave', e => {
            e.preventDefault();
            if (emptyState.style.display !== 'none') {
                emptyState.style.backgroundColor = '#fafafa';
            }
        });

        window.addEventListener('drop', e => {
            e.preventDefault();
            if (emptyState.style.display !== 'none') {
                emptyState.style.backgroundColor = '#fafafa';
            }
            
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                const files = Array.from(e.dataTransfer.files);
                const images = files.filter(isImageFile);
                if (images.length < files.length) {
                    alert('イメージ以外のファイルは対象外のため無視しました');
                }
                handleFiles(images);
            }
        });

        fileInput.addEventListener('change', e => {
            handleFiles(e.target.files);
            fileInput.value = '';
        });

        zipBtn.addEventListener('click', async () => {
            const doneFiles = filesData.filter(f => f.status === 'done' && f.downloadUrl);
            if(doneFiles.length === 0) return;
            
            zipBtn.disabled = true;
            zipBtn.textContent = '生成中...';
            
            try {
                const zip = new JSZip();
                for(const data of doneFiles) {
                    const response = await fetch(data.downloadUrl);
                    const blob = await response.blob();
                    zip.file(data.downloadName, blob);
                }
                const zipBlob = await zip.generateAsync({type: "blob"});
                const a = document.createElement('a');
                a.href = URL.createObjectURL(zipBlob);
                a.download = "converted_files.zip";
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(a.href), 10000);
            } catch (err) {
                console.error(err);
                alert("ZIP生成に失敗しました");
            }
            
            zipBtn.disabled = false;
            zipBtn.textContent = 'ZIP保存 ↓';
        });

        function formatBytes(bytes) {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
        }

        function handleFiles(newFiles) {
            if (newFiles.length === 0) return;
            
            emptyState.style.display = 'none';
            fileListContainer.style.display = 'flex';

            const skippedEmpty = [];
            Array.from(newFiles).forEach(file => {
                if (file.size === 0) {
                    skippedEmpty.push(file.name);
                    return;
                }
                const id = 'f_' + Math.random().toString(36).substr(2, 9);
                let thumbUrl = '';
                if(file.type.startsWith('image/')) {
                    thumbUrl = URL.createObjectURL(file);
                }
                
                filesData.push({
                    id: id,
                    file: file,
                    targetFormat: 'image/jpeg',
                    status: 'ready',
                    downloadUrl: null,
                    downloadName: '',
                    thumbUrl: thumbUrl
                });
            });

            if (skippedEmpty.length > 0) {
                alert('0バイトのファイルは無視しました: ' + skippedEmpty.join(', '));
            }

            renderFileList();
        }

        function removeFile(id) {
            const fileObj = filesData.find(f => f.id === id);
            if (fileObj) {
                if (fileObj.downloadUrl) URL.revokeObjectURL(fileObj.downloadUrl);
                if (fileObj.thumbUrl) URL.revokeObjectURL(fileObj.thumbUrl);
            }
            filesData = filesData.filter(f => f.id !== id);
            renderFileList();
            if (filesData.length === 0) {
                fileListContainer.style.display = 'none';
                emptyState.style.display = 'block';
            }
        }

        function changeAllFormats(format) {
            if (!format) return;
            filesData.forEach(f => {
                if (f.status === 'ready' || f.status === 'done' || f.status === 'error') {
                    if (f.status === 'done' || f.status === 'error') {
                        f.status = 'ready';
                        f.errorMsg = null;
                        if (f.downloadUrl) {
                            URL.revokeObjectURL(f.downloadUrl);
                            f.downloadUrl = null;
                            f.downloadName = '';
                        }
                    }
                    f.targetFormat = format;
                }
            });
            renderFileList();
        }

        function updateFileFormat(id, format) {
            const fileObj = filesData.find(f => f.id === id);
            if (!fileObj) return;
            if (fileObj.status === 'done' || fileObj.status === 'error') {
                fileObj.status = 'ready';
                fileObj.errorMsg = null;
                if (fileObj.downloadUrl) {
                    URL.revokeObjectURL(fileObj.downloadUrl);
                    fileObj.downloadUrl = null;
                    fileObj.downloadName = '';
                }
            }
            fileObj.targetFormat = format;
            renderFileList();
        }

        function renderFileList() {
            fileItems.innerHTML = '';
            let hasDoneFiles = false;

            filesData.forEach(data => {
                const item = document.createElement('div');
                item.className = 'file-item';
                
                let statusHtml = '';
                if (data.status === 'ready') {
                    statusHtml = '<span class="status-badge">準備完了</span>';
                } else if (data.status === 'converting') {
                    statusHtml = '<span class="status-badge processing">処理中...</span>';
                } else if (data.status === 'done') {
                    statusHtml = `<a href="${esc(data.downloadUrl)}" download="${esc(data.downloadName)}" class="status-badge done">ダウンロード</a>`;
                    hasDoneFiles = true;
                } else if (data.status === 'error') {
                    statusHtml = `<span class="status-badge error" title="${esc(data.errorMsg || '不明なエラー')}">エラー</span>`;
                }

                const thumbStyle = data.thumbUrl ? `background-image: url('${data.thumbUrl}');` : '';
                const thumbContent = data.thumbUrl ? '' : '🖼️';

                item.innerHTML = `
                    <div class="file-icon-box" style="${thumbStyle}">${thumbContent}</div>
                    <div class="file-name" title="${esc(data.file.name)}">${esc(data.file.name)}</div>
                    <div class="file-to-text">に</div>
                    <select class="format-select" onchange="updateFileFormat('${data.id}', this.value)" ${data.status === 'converting' ? 'disabled' : ''}>
                        <option value="image/jpeg" ${data.targetFormat === 'image/jpeg' ? 'selected' : ''}>JPG</option>
                        <option value="image/jpeg_ext" ${data.targetFormat === 'image/jpeg_ext' ? 'selected' : ''}>JPEG</option>
                        <option value="image/png" ${data.targetFormat === 'image/png' ? 'selected' : ''}>PNG</option>
                        <option value="image/webp" ${data.targetFormat === 'image/webp' ? 'selected' : ''}>WEBP</option>
                        <option value="image/avif" ${data.targetFormat === 'image/avif' ? 'selected' : ''}>AVIF</option>
                        <option value="image/bmp" ${data.targetFormat === 'image/bmp' ? 'selected' : ''}>BMP</option>
                        <option value="image/x-icon" ${data.targetFormat === 'image/x-icon' ? 'selected' : ''}>ICO</option>
                        <option value="image/gif" ${data.targetFormat === 'image/gif' ? 'selected' : ''}>GIF</option>
                        <option value="application/pdf" ${data.targetFormat === 'application/pdf' ? 'selected' : ''}>PDF</option>
                        <option value="application/postscript" ${data.targetFormat === 'application/postscript' ? 'selected' : ''}>EPS</option>
                    </select>
                    <div style="width: 120px; text-align: center;">${statusHtml}</div>
                    <div class="file-size">${formatBytes(data.file.size)}</div>
                    <button class="btn-remove" onclick="removeFile('${data.id}')">✕</button>
                `;
                fileItems.appendChild(item);
            });

            zipBtn.style.display = hasDoneFiles ? 'flex' : 'none';
        }

        function encodeBMP(canvas) {
            const width = canvas.width;
            const height = canvas.height;
            const ctx = canvas.getContext("2d");
            const imageData = ctx.getImageData(0, 0, width, height);
            const data = imageData.data;
            const rowSize = Math.ceil((width * 3) / 4) * 4;
            const pixelArraySize = rowSize * height;
            const fileSize = 54 + pixelArraySize;
            const buffer = new ArrayBuffer(fileSize);
            const view = new DataView(buffer);
            view.setUint16(0, 0x4D42, false);
            view.setUint32(2, fileSize, true);
            view.setUint32(10, 54, true);
            view.setUint32(14, 40, true);
            view.setUint32(18, width, true);
            view.setInt32(22, height, true);
            view.setUint16(26, 1, true);
            view.setUint16(28, 24, true);
            view.setUint32(34, pixelArraySize, true);
            let offset = 54;
            for (let y = height - 1; y >= 0; y--) {
                for (let x = 0; x < width; x++) {
                    const p = (y * width + x) * 4;
                    view.setUint8(offset, data[p + 2]);
                    view.setUint8(offset + 1, data[p + 1]);
                    view.setUint8(offset + 2, data[p]);
                    offset += 3;
                }
                offset += rowSize - width * 3;
            }
            return new Blob([buffer], { type: "image/bmp" });
        }

        async function encodeICO(canvas) {
            let width = canvas.width;
            let height = canvas.height;
            if (width > 256 || height > 256) {
                const ratio = Math.min(256 / width, 256 / height);
                width = Math.round(width * ratio);
                height = Math.round(height * ratio);
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = width;
                tempCanvas.height = height;
                tempCanvas.getContext('2d').drawImage(canvas, 0, 0, width, height);
                canvas = tempCanvas;
            }
            return new Promise((resolve, reject) => {
                canvas.toBlob(blob => {
                    if (!blob) {
                        reject(new Error('ICOエンコードに失敗しました'));
                        return;
                    }
                    blob.arrayBuffer().then(buffer => {
                        const pngData = new Uint8Array(buffer);
                        const icoSize = 22 + pngData.length;
                        const icoBuffer = new ArrayBuffer(icoSize);
                        const view = new DataView(icoBuffer);
                        view.setUint16(0, 0, true);
                        view.setUint16(2, 1, true);
                        view.setUint16(4, 1, true);
                        view.setUint8(6, width === 256 ? 0 : width);
                        view.setUint8(7, height === 256 ? 0 : height);
                        view.setUint8(8, 0);
                        view.setUint8(9, 0);
                        view.setUint16(10, 1, true);
                        view.setUint16(12, 32, true);
                        view.setUint32(14, pngData.length, true);
                        view.setUint32(18, 22, true);
                        new Uint8Array(icoBuffer).set(pngData, 22);
                        resolve(new Blob([icoBuffer], { type: "image/x-icon" }));
                    });
                }, 'image/png');
            });
        }

        function encodeEPS(canvas) {
            const width = canvas.width;
            const height = canvas.height;
            const ctx = canvas.getContext('2d');
            const imgData = ctx.getImageData(0, 0, width, height).data;

            const parts = [];
            parts.push("%!PS-Adobe-3.0 EPSF-3.0\n");
            parts.push(`%%BoundingBox: 0 0 ${width} ${height}\n`);
            parts.push("%%LanguageLevel: 2\n");
            parts.push("%%EndComments\n");
            parts.push("gsave\n");
            parts.push(`${width} ${height} scale\n`);
            parts.push("/DeviceRGB setcolorspace\n");
            parts.push("<<\n");
            parts.push("  /ImageType 1\n");
            parts.push(`  /Width ${width}\n`);
            parts.push(`  /Height ${height}\n`);
            parts.push("  /BitsPerComponent 8\n");
            parts.push("  /Decode [0 1 0 1 0 1]\n");
            parts.push(`  /ImageMatrix [${width} 0 0 -${height} 0 ${height}]\n`);
            parts.push("  /DataSource currentfile /ASCIIHexDecode filter\n");
            parts.push(">>\n");
            parts.push("image\n");

            const hexArray = [];
            let currentLine = "";
            for (let i = 0; i < imgData.length; i += 4) {
                const byteHex = imgData[i].toString(16).padStart(2, '0') +
                                imgData[i+1].toString(16).padStart(2, '0') +
                                imgData[i+2].toString(16).padStart(2, '0');
                if (currentLine.length >= 66) {
                    hexArray.push(currentLine);
                    currentLine = "";
                }
                currentLine = currentLine + byteHex;
            }
            if (currentLine.length > 0) {
                hexArray.push(currentLine);
            }

            parts.push(hexArray.join("\n") + "\n>\n");
            parts.push("grestore\n");
            parts.push("%%EOF\n");

            return new Blob([parts.join("")], { type: "application/postscript" });
        }

        function getExtension(mimeType) {
            const map = {
                'image/jpeg': 'jpg',
                'image/jpeg_ext': 'jpeg',
                'image/png': 'png',
                'image/webp': 'webp',
                'image/avif': 'avif',
                'image/bmp': 'bmp',
                'image/x-icon': 'ico',
                'image/gif': 'gif',
                'application/pdf': 'pdf',
                'application/postscript': 'eps'
            };
            return map[mimeType] || 'png';
        }

        async function processFile(data) {
            data.downloadName = '';
            data.status = 'converting';
            renderFileList();

            try {
                let currentFile = data.file;
                const fileNameLower = currentFile.name.toLowerCase();
                const dot = currentFile.name.lastIndexOf('.');
                const baseFileName = dot > 0 ? currentFile.name.substring(0, dot) : currentFile.name;
                const qualityValue = parseInt(qualityRange.value) / 100;
                
                const rw = document.getElementById('resizeWidth').value;
                const rh = document.getElementById('resizeHeight').value;

                if (fileNameLower.endsWith('.heic') || fileNameLower.endsWith('.heif')) {
                    const arr = await heic2any({ blob: currentFile, toType: "image/jpeg", quality: qualityValue });
                    const convertedBlob = arr[0];
                    if (arr.length > 1) {
                        console.warn(`HEICには${arr.length}枚のフレームが含まれていましたが、1枚目のみ変換します`);
                    }
                    currentFile = new File([convertedBlob], "temp.jpg", { type: "image/jpeg" });
                }

                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = e => {
                        const img = new Image();
                        img.onload = async () => {
                            const finalize = (blob, errorMsg) => {
                                if (!blob) {
                                    data.status = 'error';
                                    data.errorMsg = errorMsg || '変換に失敗しました';
                                } else {
                                    data.status = 'done';
                                    data.errorMsg = null;
                                    data.downloadUrl = URL.createObjectURL(blob);
                                    const ext = getExtension(data.targetFormat);
                                    let name = baseFileName + '.' + ext;
                                    const existingNames = new Set(filesData.map(f => f.downloadName).filter(n => n));
                                    let suffix = 1;
                                    while (existingNames.has(name)) {
                                        name = `${baseFileName}_${suffix}.${ext}`;
                                        suffix++;
                                    }
                                    data.downloadName = name;
                                }
                                resolve();
                            };

                            let targetWidth = img.width;
                            let targetHeight = img.height;
                            
                            if (rw || rh) {
                                if (rw && !rh) {
                                    targetWidth = parseInt(rw);
                                    targetHeight = Math.round(img.height * (targetWidth / img.width));
                                } else if (!rw && rh) {
                                    targetHeight = parseInt(rh);
                                    targetWidth = Math.round(img.width * (targetHeight / img.height));
                                } else {
                                    targetWidth = parseInt(rw);
                                    targetHeight = parseInt(rh);
                                }
                            }

                            const MAX_CANVAS_DIM = 16384;
                            if (!Number.isFinite(targetWidth) || !Number.isFinite(targetHeight) || targetWidth <= 0 || targetHeight <= 0) {
                                return finalize(null, '無効なサイズです（リサイズ値を確認してください）');
                            }
                            if (targetWidth > MAX_CANVAS_DIM || targetHeight > MAX_CANVAS_DIM) {
                                return finalize(null, `サイズが大きすぎます（最大${MAX_CANVAS_DIM}px）`);
                            }
                            const MAX_PIXELS = 50000000;
                            if (targetWidth * targetHeight > MAX_PIXELS) {
                                return finalize(null, '画像が大きすぎます');
                            }

                            const canvas = document.createElement('canvas');
                            canvas.width = targetWidth;
                            canvas.height = targetHeight;
                            if (canvas.width === 0 || canvas.height === 0) {
                                return finalize(null, 'キャンバスを初期化できませんでした（サイズが大きすぎます）');
                            }
                            const ctx = canvas.getContext('2d');

                            if (['image/jpeg', 'image/jpeg_ext', 'image/bmp', 'application/pdf', 'application/postscript'].includes(data.targetFormat)) {
                                ctx.fillStyle = '#FFFFFF';
                                ctx.fillRect(0, 0, canvas.width, canvas.height);
                            }
                            ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

                            if (data.targetFormat === 'image/bmp') {
                                finalize(encodeBMP(canvas));
                            } else if (data.targetFormat === 'image/x-icon') {
                                try {
                                    finalize(await encodeICO(canvas));
                                } catch (err) {
                                    finalize(null, err.message);
                                }
                            } else if (data.targetFormat === 'application/postscript') {
                                finalize(encodeEPS(canvas));
                            } else if (data.targetFormat === 'application/pdf') {
                                const { jsPDF } = window.jspdf;
                                const isLandscape = targetWidth > targetHeight;
                                const MARGIN_MM = 10;
                                let pageWidthMm, pageHeightMm;
                                if (isLandscape) {
                                    pageHeightMm = 210;
                                    pageWidthMm = Math.min(210 * targetWidth / targetHeight, 297);
                                } else {
                                    pageWidthMm = 210;
                                    pageHeightMm = Math.min(210 * targetHeight / targetWidth, 297);
                                }
                                const pdf = new jsPDF({
                                    orientation: isLandscape ? 'l' : 'p',
                                    unit: 'mm',
                                    format: [pageWidthMm, pageHeightMm]
                                });
                                const imgData = canvas.toDataURL('image/jpeg', qualityValue);
                                const availWidthMm = Math.max(pageWidthMm - 2 * MARGIN_MM, 1);
                                const availHeightMm = Math.max(pageHeightMm - 2 * MARGIN_MM, 1);
                                const scale = Math.min(availWidthMm / targetWidth, availHeightMm / targetHeight);
                                const imgWidthMm = targetWidth * scale;
                                const imgHeightMm = targetHeight * scale;
                                const posX = MARGIN_MM + (availWidthMm - imgWidthMm) / 2;
                                const posY = MARGIN_MM + (availHeightMm - imgHeightMm) / 2;
                                pdf.addImage(imgData, 'JPEG', posX, posY, imgWidthMm, imgHeightMm);
                                finalize(pdf.output('blob'));
                            } else {
                                const exportFormat = data.targetFormat === 'image/jpeg_ext' ? 'image/jpeg' : data.targetFormat;
                                canvas.toBlob(blob => finalize(blob, !blob ? 'この形式への書き出しがサポートされていません' : null), exportFormat, qualityValue);
                            }
                        };
                        img.onerror = () => reject(new Error('Failed to decode image'));
                        img.src = e.target.result;
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(currentFile);
                }).catch(error => {
                    console.error(error);
                    data.status = 'error';
                    data.errorMsg = error && error.message ? error.message : String(error);
                });
            } catch (error) {
                console.error(error);
                data.status = 'error';
                data.errorMsg = error && error.message ? error.message : String(error);
            }
        }

        convertBtn.addEventListener('click', async () => {
            const pendingFiles = filesData.filter(f => f.status === 'ready');
            if (pendingFiles.length === 0) return;

            convertBtn.disabled = true;
            convertBtn.textContent = '処理中...';

            try {
                for (const data of pendingFiles) {
                    await processFile(data);
                    renderFileList();
                }
            } catch (error) {
                console.error(error);
            } finally {
                convertBtn.disabled = false;
                convertBtn.textContent = '変換 →';
            }
        });
    