// staff.jsx
import { School, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";

export function IdCard({ type, name, idNumber, subtitle, meta = [], photoUrl, validUntil }) {
    const themeColor = type === "student" ? "sky" : "purple";
    const [schoolName, setSchoolName] = useState("Nexus Academy");
    const [schoolLogo, setSchoolLogo] = useState("");

    // Load school settings from localStorage
    useEffect(() => {
        const loadSchoolSettings = () => {
            try {
                const saved = localStorage.getItem('schoolSettings');
                if (saved) {
                    const settings = JSON.parse(saved);
                    setSchoolName(settings.name || "Nexus Academy");
                    setSchoolLogo(settings.logoUrl || "");
                }
            } catch (error) {
                console.error("Failed to load school settings:", error);
            }
        };

        loadSchoolSettings();

        // Listen for settings updates
        const handleSettingsUpdate = (e) => {
            if (e.key === 'schoolSettings' && e.newValue) {
                try {
                    const settings = JSON.parse(e.newValue);
                    setSchoolName(settings.name || "Nexus Academy");
                    setSchoolLogo(settings.logoUrl || "");
                } catch (error) {
                    console.error("Error parsing settings:", error);
                }
            }
        };

        const handleCustomEvent = (e) => {
            const settings = e.detail;
            if (settings) {
                setSchoolName(settings.name || "Nexus Academy");
                setSchoolLogo(settings.logoUrl || "");
            }
        };

        window.addEventListener('storage', handleSettingsUpdate);
        window.addEventListener('schoolSettingsUpdated', handleCustomEvent);

        return () => {
            window.removeEventListener('storage', handleSettingsUpdate);
            window.removeEventListener('schoolSettingsUpdated', handleCustomEvent);
        };
    }, []);

    const handlePrint = () => {
        const w = window.open("", "_blank", "width=420,height=640");
        if (!w) return;
        
        const doc = w.document;
        doc.open();
        doc.write('<!doctype html><html><head></head><body></body></html>');
        doc.close();
        doc.title = `${name} - ID Card`;
        
        // Add Tailwind CSS via CDN
        const tw = doc.createElement("script");
        tw.src = "https://cdn.tailwindcss.com";
        doc.head.appendChild(tw);
        
        // Add custom styles for the ID card
        const style = doc.createElement("style");
        style.textContent = `
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body { 
                background: #0a0a0a; 
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                font-family: system-ui, -apple-system, sans-serif;
                padding: 20px;
            }

            .id-card {
                width: 340px;
                background: linear-gradient(135deg, rgba(14, 165, 233, 0.15), rgba(24, 24, 27, 0.95), rgba(9, 9, 11, 0.98));
                border: 1px solid rgba(14, 165, 233, 0.3);
                border-radius: 12px;
                overflow: hidden;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8), 0 0 40px rgba(14, 165, 233, 0.1);
            }

            /* Header */
            .card-header {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 12px 16px;
                background: rgba(14, 165, 233, 0.15);
                border-bottom: 1px solid rgba(14, 165, 233, 0.25);
            }

            .card-header .icon {
                width: 20px;
                height: 20px;
                color: #7dd3fc;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .card-header .school-name {
                font-size: 10px;
                color: #a1a1aa;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                line-height: 1.2;
            }

            .card-header .card-type {
                font-size: 11px;
                font-weight: 600;
                color: #ffffff;
                text-transform: capitalize;
                line-height: 1.2;
            }

            /* Body */
            .card-body {
                padding: 16px;
                display: flex;
                gap: 16px;
                align-items: flex-start;
            }

            .photo-placeholder {
                width: 80px;
                height: 96px;
                border-radius: 6px;
                border: 2px solid rgba(14, 165, 233, 0.3);
                background: #27272a;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 28px;
                font-weight: 700;
                color: #7dd3fc;
                flex-shrink: 0;
                overflow: hidden;
            }

            .photo-placeholder img {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }

            .info-section {
                flex: 1;
                min-width: 0;
            }

            .info-label {
                font-size: 9px;
                color: #71717a;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                line-height: 1.4;
            }

            .info-value {
                font-size: 13px;
                font-weight: 700;
                color: #ffffff;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                line-height: 1.4;
            }

            .info-subtitle {
                font-size: 11px;
                color: #7dd3fc;
                margin-top: 2px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .info-details {
                margin-top: 8px;
                display: flex;
                flex-direction: column;
                gap: 4px;
            }

            .info-row .info-label {
                font-size: 8px;
            }

            .info-row .info-value {
                font-size: 11px;
                font-weight: 600;
                color: #7dd3fc;
                font-family: monospace;
            }

            /* Footer */
            .card-footer {
                padding: 8px 16px;
                background: rgba(14, 165, 233, 0.08);
                border-top: 1px solid rgba(14, 165, 233, 0.15);
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .card-footer .footer-text {
                font-size: 9px;
                color: #a1a1aa;
            }

            .card-footer .footer-italic {
                font-size: 9px;
                color: #52525b;
                font-style: italic;
            }

            /* Print specific styles */
            @media print {
                body {
                    background: white !important;
                    padding: 0 !important;
                }
                
                .id-card {
                    box-shadow: none !important;
                    border: 1px solid #e4e4e7 !important;
                    background: white !important;
                }

                .card-header {
                    background: #f4f4f5 !important;
                    border-bottom: 1px solid #e4e4e7 !important;
                }

                .card-header .school-name {
                    color: #71717a !important;
                }

                .card-header .card-type {
                    color: #18181b !important;
                }

                .photo-placeholder {
                    border-color: #d4d4d8 !important;
                    background: #f4f4f5 !important;
                    color: #3b82f6 !important;
                }

                .info-value {
                    color: #18181b !important;
                }

                .info-subtitle {
                    color: #3b82f6 !important;
                }

                .info-row .info-value {
                    color: #3b82f6 !important;
                }

                .card-footer {
                    background: #fafafa !important;
                    border-top: 1px solid #e4e4e7 !important;
                }

                .card-footer .footer-text {
                    color: #71717a !important;
                }

                .card-footer .footer-italic {
                    color: #a1a1aa !important;
                }
            }
        `;
        doc.head.appendChild(style);
        
        // Build the HTML content
        const html = `
            <div class="id-card">
                <!-- Header -->
                <div class="card-header">
                    <div class="icon">
                        ${schoolLogo ? `<img src="${schoolLogo}" alt="School Logo" style="width:20px;height:20px;object-fit:contain;" />` : '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6l8-4 8 4"/><path d="M4 6v12l8 4 8-4V6"/><path d="M16 10l-4-2-4 2"/><path d="M12 8v8"/></svg>'}
                    </div>
                    <div>
                        <div class="school-name">${schoolName}</div>
                        <div class="card-type">${type} Identity Card</div>
                    </div>
                </div>
                
                <!-- Body -->
                <div class="card-body">
                    <div class="photo-placeholder">
                        ${photoUrl ? `<img src="${photoUrl}" alt="${name}" />` : name.charAt(0).toUpperCase()}
                    </div>
                    <div class="info-section">
                        <div class="info-label">Name</div>
                        <div class="info-value">${name}</div>
                        ${subtitle ? `<div class="info-subtitle">${subtitle}</div>` : ''}
                        <div class="info-details">
                            <div class="info-row">
                                <div class="info-label">ID No.</div>
                                <div class="info-value">${idNumber}</div>
                            </div>
                            ${meta.map(m => `
                                <div class="info-row">
                                    <div class="info-label">${m.label}</div>
                                    <div class="info-value" style="font-weight:500;color:#fff;font-family:system-ui;">${m.value}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
                
                <!-- Footer -->
                <div class="card-footer">
                    <div class="footer-text">${validUntil ? `Valid until ${validUntil}` : `Property of ${schoolName}`}</div>
                    <div class="footer-italic">If found, return to school office</div>
                </div>
            </div>
        `;
        
        // Insert the HTML
        const body = doc.body;
        // Create a wrapper div for proper centering
        const wrapper = doc.createElement('div');
        wrapper.style.display = 'flex';
        wrapper.style.justifyContent = 'center';
        wrapper.style.alignItems = 'center';
        wrapper.style.minHeight = '100vh';
        wrapper.style.padding = '20px';
        wrapper.innerHTML = html;
        body.appendChild(wrapper);
        
        // Wait for images to load then print
        setTimeout(() => {
            w.print();
        }, 500);
    };

    // Color mapping for the component's theme
    const colorMap = {
        sky: {
            primary: 'sky',
            bg: 'from-sky-900/40',
            border: 'border-sky-500/30',
            headerBg: 'bg-sky-500/20',
            headerBorder: 'border-sky-500/30',
            text: 'text-sky-300',
            photoBorder: 'border-sky-500/40',
            footerBg: 'bg-sky-500/10',
            footerBorder: 'border-sky-500/20'
        },
        purple: {
            primary: 'purple',
            bg: 'from-purple-900/40',
            border: 'border-purple-500/30',
            headerBg: 'bg-purple-500/20',
            headerBorder: 'border-purple-500/30',
            text: 'text-purple-300',
            photoBorder: 'border-purple-500/40',
            footerBg: 'bg-purple-500/10',
            footerBorder: 'border-purple-500/20'
        }
    };

    const colors = colorMap[themeColor] || colorMap.sky;

    return (
        <div className="space-y-3">
            <div id="id-card-print" className={`relative mx-auto w-[320px] rounded-xl overflow-hidden bg-gradient-to-br ${colors.bg} via-zinc-900 to-zinc-950 border ${colors.border} shadow-2xl`}>
                {/* Header with dynamic school name */}
                <div className={`flex items-center gap-2 px-4 py-3 ${colors.headerBg} border-b ${colors.headerBorder}`}>
                    {schoolLogo ? (
                        <img src={schoolLogo} alt="School Logo" className="w-5 h-5 object-contain" />
                    ) : (
                        <School className={`w-5 h-5 ${colors.text}`} />
                    )}
                    <div className="flex-1">
                        <p className="text-[10px] text-zinc-400 uppercase tracking-wider">{schoolName}</p>
                        <p className={`text-xs font-semibold capitalize text-white`}>{type} Identity Card</p>
                    </div>
                </div>
                
                {/* Body */}
                <div className="p-4 flex gap-4 items-start">
                    <div className={`w-20 h-24 rounded-md border-2 ${colors.photoBorder} bg-zinc-800 flex items-center justify-center text-2xl font-bold ${colors.text} overflow-hidden shrink-0`}>
                        {photoUrl ? (
                            <img src={photoUrl} alt={name} className="w-full h-full object-cover" />
                        ) : (
                            <span>{name.charAt(0).toUpperCase()}</span>
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-zinc-400 uppercase">Name</p>
                        <p className="text-sm font-bold text-white truncate">{name}</p>
                        {subtitle && <p className={`text-xs ${colors.text} mt-0.5 truncate`}>{subtitle}</p>}
                        <div className="mt-2 space-y-1">
                            <div>
                                <p className="text-[9px] text-zinc-500 uppercase">ID No.</p>
                                <p className={`text-xs font-mono font-bold ${colors.text}`}>{idNumber}</p>
                            </div>
                            {meta.map((m) => (
                                <div key={m.label}>
                                    <p className="text-[9px] text-zinc-500 uppercase">{m.label}</p>
                                    <p className="text-xs font-medium text-white truncate">{m.value}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                
                {/* Footer with dynamic school name */}
                <div className={`px-4 py-2 ${colors.footerBg} border-t ${colors.footerBorder} flex justify-between items-center`}>
                    <p className="text-[9px] text-zinc-400">
                        {validUntil ? `Valid until ${validUntil}` : `Property of ${schoolName}`}
                    </p>
                    <p className="text-[9px] text-zinc-500 italic">If found, return to school office</p>
                </div>
            </div>
            
            <Button variant="outline" size="sm" className="w-full gap-2" onClick={handlePrint}>
                <Printer className="w-3.5 h-3.5" /> Print ID Card
            </Button>
        </div>
    );
}