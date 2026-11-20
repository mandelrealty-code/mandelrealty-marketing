// @ts-nocheck
export const CRM_CSS = ":host{display:block;min-height:100dvh;background:#ffffff}\n\n/* =========================================================\n   Tokens: same as the hub (OKLCH palette, alpha borders, one type scale)\n   ========================================================= */\n:host, :root{\n  --bg:#ffffff; --panel:#f2f2ef;\n  --ink: oklch(0.21 0.006 285); --ink2: oklch(0.32 0.006 285); --muted: oklch(0.45 0.008 285);\n  --line: rgb(0 0 0 / 0.11); --line-2: rgb(0 0 0 / 0.06); --hover: rgb(0 0 0 / 0.04); --press: rgb(0 0 0 / 0.07);\n  --gold:#c4a35a; --primary:#18181b;\n  --blue: oklch(0.6 0.15 255); --amber: oklch(0.6 0.14 65); --red: oklch(0.6 0.19 25); --grey: oklch(0.6 0.015 270);\n  --teal: oklch(0.6 0.11 185); --green: oklch(0.6 0.13 155);\n  --redink: oklch(0.48 0.17 25); --amberink: oklch(0.47 0.12 60); --greenink: oklch(0.42 0.1 155); --tealink: oklch(0.42 0.09 185);\n  --t-xs:12px; --t-sm:13px; --t-base:14px; --t-md:16px; --t-lg:24px;\n  --r-card:16px; --r-ctl:10px; --r-pill:999px;\n  --ease: cubic-bezier(.65,0,.35,1); --fast:110ms; --med:180ms; --slow:260ms;\n  --safe-b: env(safe-area-inset-bottom, 0px);\n  --safe-t: env(safe-area-inset-top, 0px);\n}\n*{box-sizing:border-box}\n[hidden]{display:none!important}\n.crm{margin:0;background:var(--bg);color:var(--ink2);font-family:Inter,system-ui,-apple-system,sans-serif;font-size:var(--t-base);line-height:1.5;-webkit-font-smoothing:antialiased;-webkit-tap-highlight-color:transparent}\nbutton,input,select,textarea{font:inherit;color:inherit}\nbutton{cursor:pointer;-webkit-user-select:none;user-select:none}\nbutton[disabled]{cursor:default}\na{color:inherit}\n::placeholder{color:oklch(0.55 0.008 285)}\n:focus-visible{outline:2px solid oklch(0.6 0.15 255 / .55);outline-offset:2px}\nh1,h2,h3,h4,h5,h6{margin:0;color:var(--ink)}\n.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}\nsvg.i{width:18px;height:18px;flex:none;fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round}\nsvg.i.sm{width:16px;height:16px}\nsvg.i.xs{width:14px;height:14px}\n\n/* ===================== Shared UI (matches hub) ===================== */\n.card{background:var(--bg);border:1px solid var(--line);border-radius:var(--r-card)}\n.btn{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:8px;border-radius:var(--r-ctl);padding:0 14px;height:40px;font-size:var(--t-sm);font-weight:500;border:1px solid var(--line);background:var(--bg);color:var(--ink);white-space:nowrap;text-decoration:none;transition:background var(--fast) var(--ease),transform var(--fast) var(--ease)}\n.btn:hover{background:var(--hover)}\n.btn:active{transform:scale(.97);background:var(--press)}\n.btn.sm{height:32px;padding:0 11px;font-size:var(--t-xs);border-radius:8px}\n.btn.primary{background:var(--primary);border-color:transparent;color:#fff;font-weight:600}\n.btn.primary:hover{background:oklch(0.29 0.006 285)}\n.btn.primary svg.i{stroke-width:2.1}\n.btn.ghost{border-color:transparent;background:none;color:var(--ink2)}\n.btn.ghost:hover{background:var(--hover)}\n.btn.danger{background:oklch(0.55 0.17 25);border-color:transparent;color:#fff;font-weight:600}\n.btn.danger:hover{background:oklch(0.5 0.17 25)}\n.btn.dangerline{color:var(--redink);border-color:oklch(0.6 0.19 25 / .35)}\n.btn.ok{background:oklch(0.94 0.05 155);border-color:oklch(0.6 0.13 155 / .35);color:var(--greenink)}\n.btn[disabled],.btn.dis{opacity:.5;pointer-events:none}\n.cta-add .plus{transition:transform var(--slow) var(--ease)}\n.cta-add:hover .plus{transform:rotate(90deg)}\n.iconbtn{position:relative;width:36px;height:36px;border-radius:9px;border:1px solid transparent;background:none;display:inline-grid;place-items:center;color:var(--ink2);flex:none;transition:background var(--fast) var(--ease)}\n.iconbtn:hover{background:var(--hover)}\n.iconbtn:active{background:var(--press)}\n.iconbtn.bd{border-color:var(--line)}\n.chip{display:inline-flex;align-items:center;gap:5px;border-radius:var(--r-pill);padding:2px 9px;font-size:var(--t-xs);font-weight:600;white-space:nowrap;line-height:1.4}\n.count{font-size:var(--t-xs);font-weight:600;color:var(--ink2);background:var(--panel);border:1px solid var(--line-2);border-radius:var(--r-pill);padding:1px 8px}\n.dot{width:8px;height:8px;border-radius:50%;display:inline-block;flex:none}\n.meta{color:var(--muted);font-size:var(--t-xs);font-weight:500}\n.gap{color:var(--amberink);font-weight:600}\n.gapchip{display:inline-flex;align-items:center;gap:4px;border-radius:var(--r-pill);padding:1px 8px;font-size:11px;font-weight:600;background:oklch(0.6 0.14 65 / .14);color:var(--amberink);white-space:nowrap}\n.input{border:1px solid var(--line);border-radius:var(--r-ctl);padding:0 12px;height:40px;font-size:var(--t-sm);background:var(--bg);width:100%;color:var(--ink);outline:none;transition:border-color var(--fast) var(--ease),box-shadow var(--fast) var(--ease)}\n.input:focus,.input.focus{border-color:oklch(0.6 0.15 255 / .6);box-shadow:0 0 0 3px oklch(0.6 0.15 255 / .12)}\n.input[disabled]{background:var(--panel);color:var(--muted)}\nselect.input{-webkit-appearance:none;appearance:none;padding-right:34px;background:var(--bg) url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2352525b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\") no-repeat right 11px center/16px;cursor:pointer}\ntextarea.input{height:auto;min-height:84px;padding:10px 12px;resize:vertical;line-height:1.5}\n.input.warn{border-color:oklch(0.6 0.14 65 / .7);box-shadow:0 0 0 3px oklch(0.6 0.14 65 / .14)}\n.input.warn::placeholder{color:var(--amberink);font-weight:600}\nselect.input.warn{color:var(--amberink);font-weight:600}\n.field label,.flabel{display:block;font-size:var(--t-xs);font-weight:600;color:var(--ink);margin-bottom:5px}\n.field label em{font-style:normal;font-weight:500;color:var(--muted)}\n.hint{font-size:var(--t-xs);font-weight:500;color:var(--muted);margin-top:5px;display:flex;gap:5px;align-items:center}\n.hint:empty{display:none}\n.hint.bad{color:var(--redink)} .hint.warn{color:var(--amberink)} .hint.good{color:var(--greenink)}\n.switch{position:relative;width:44px;height:26px;flex:none;display:inline-block;border:0;padding:0;background:none}\n.switch i{position:absolute;inset:0;border-radius:var(--r-pill);background:oklch(0.82 0.005 285);transition:background var(--med) var(--ease)}\n.switch i::after{content:\"\";position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgb(0 0 0 / .2);transition:left var(--med) var(--ease)}\n.switch.on i{background:var(--primary)} .switch.on i::after{left:21px}\n.switch[disabled]{opacity:.5}\n.seg{display:inline-flex;background:var(--panel);border:1px solid var(--line-2);border-radius:12px;padding:3px}\n.seg button{display:inline-flex;align-items:center;justify-content:center;gap:6px;border:0;background:none;border-radius:9px;height:32px;padding:0 14px;font-size:var(--t-sm);font-weight:500;color:var(--ink2)}\n.seg button.on{background:var(--bg);color:var(--ink);font-weight:600;box-shadow:0 0 0 1px var(--line)}\n.av{width:36px;height:36px;border-radius:50%;display:inline-grid;place-items:center;font-size:12px;font-weight:600;color:#fff;flex:none}\n.av.sm{width:28px;height:28px;font-size:11px}\n.frost{background:rgb(255 255 255 / .94);backdrop-filter:blur(22px) saturate(1.5);-webkit-backdrop-filter:blur(22px) saturate(1.5);border:1px solid var(--line);box-shadow:0 12px 40px rgb(0 0 0 / .12)}\n.scrim{position:fixed;inset:0;background:rgb(20 20 25 / .2);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);z-index:90;display:flex;align-items:center;justify-content:center;padding:16px}\n.scrim.top{align-items:flex-start;padding-top:12vh}\n.scrim.side{justify-content:flex-end;align-items:stretch;padding:0}\n.scrim.bottom{align-items:flex-end;padding:0}\n.modal{border-radius:20px;padding:24px;width:540px;max-width:100%;max-height:92dvh;overflow:auto}\n.modal.narrow{width:440px}\n.modal h2{font-size:20px;font-weight:650}\n.lede{font-size:var(--t-sm);margin:4px 0 18px}\n.mfoot{display:flex;justify-content:flex-end;gap:10px;margin-top:20px}\n.sheet{width:100%;border-radius:20px 20px 0 0;padding:20px 18px calc(28px + var(--safe-b));max-height:92dvh;overflow:auto}\n.toast{position:fixed;left:50%;bottom:24px;transform:translate(-50%,10px);background:var(--primary);color:#fff;border-radius:12px;padding:0 16px;min-height:44px;max-width:calc(100vw - 32px);font-size:var(--t-sm);font-weight:500;display:flex;align-items:center;gap:8px;z-index:120;opacity:0;pointer-events:none;transition:opacity var(--med) var(--ease),transform var(--med) var(--ease)}\n.toast.show{opacity:1;transform:translate(-50%,0)}\n.toast.bad{background:oklch(0.96 0.03 65);color:var(--ink);border:1px solid oklch(0.6 0.14 65 / .45)}\n.toast.bad svg{color:var(--amberink)}\n.fgrid{display:grid;grid-template-columns:1fr 1fr;gap:14px}\n.fgrid .full{grid-column:1 / -1}\n@keyframes spin{to{transform:rotate(360deg)}}\n.spin{width:14px;height:14px;border-radius:50%;border:2px solid oklch(0.85 0.005 285);border-top-color:var(--ink);display:inline-block;animation:spin .8s linear infinite;flex:none}\n\n/* ===================== App shell (same as the onboarding hub) ===================== */\n.app{--sw:232px;display:grid;grid-template-columns:var(--sw) minmax(0,1fr);height:100dvh;transition:grid-template-columns var(--slow) var(--ease)}\n.side{border-right:1px solid var(--line);background:var(--bg);display:flex;flex-direction:column;padding:20px 12px 14px;overflow-y:auto;min-height:0}\n.brand{display:flex;align-items:center;gap:10px;padding:0 8px}\n.brand img{width:34px;height:34px;flex:none}\n.brand b{flex:1;min-width:0;font-size:var(--t-md);font-weight:650;color:var(--ink);white-space:nowrap;overflow:hidden;letter-spacing:-.2px}\n.sidetog{margin-right:-6px}\n.sidetog .chv{transition:transform var(--med) var(--ease);transform-origin:14.5px 12px}\n.jump{display:flex;align-items:center;gap:10px;margin:18px 0 6px;width:100%;height:40px;padding:0 10px;border-radius:var(--r-ctl);border:1px solid var(--line);background:var(--bg);color:var(--ink2);font-size:var(--t-sm);transition:background var(--fast) var(--ease)}\n.jump:hover{background:var(--hover)}\n.jump span{flex:1;text-align:left}\nkbd{font:600 11px/1 Inter,sans-serif;color:var(--ink2);background:#fff;border:1px solid var(--line);border-bottom-width:2px;border-radius:5px;padding:3px 5px}\n.navgroup{margin-top:16px}\n.navgroup h4{font-size:var(--t-xs);font-weight:600;color:var(--muted);padding:0 12px 4px}\n.nav button{position:relative;display:flex;align-items:center;gap:11px;width:100%;border:1px solid transparent;background:none;height:40px;padding:0 12px;border-radius:10px;color:var(--ink2);font-size:var(--t-base);font-weight:500;text-align:left;transition:background var(--fast) var(--ease)}\n.nav button:hover{background:var(--hover)}\n.nav button:active{background:var(--press)}\n.nav button.active{border-color:rgb(0 0 0 / .1);background:rgb(0 0 0 / .045);color:var(--ink);font-weight:600}\n.nav button.active::before{content:none;display:none}\n.nav button.active svg.i{stroke-width:2.1}\n.side .spacer{flex:1;min-height:16px}\n.side .foot{border-top:1px solid var(--line-2);padding-top:10px}\n.me{display:flex;align-items:center;gap:10px;padding:12px 12px 0;font-size:var(--t-sm);color:var(--ink);font-weight:500}\n.me small{display:block;color:var(--muted);font-size:var(--t-xs);font-weight:400}\n/* collapsed sidebar: icon rail */\n.crm.sb-collapsed .app{--sw:68px}\n.crm.sb-collapsed .side{padding-left:10px;padding-right:10px}\n.crm.sb-collapsed .side .brand{flex-direction:column;gap:12px;padding:0}\n.crm.sb-collapsed .side .brand b,.crm.sb-collapsed .side .nl,.crm.sb-collapsed .side kbd,.crm.sb-collapsed .navgroup h4{display:none}\n.crm.sb-collapsed .sidetog{margin:0}\n.crm.sb-collapsed .sidetog .chv{transform:scaleX(-1)}\n.crm.sb-collapsed .jump{justify-content:center;padding:0}\n.crm.sb-collapsed .nav button{justify-content:center;padding:0;gap:0}\n.crm.sb-collapsed /* active pill only */\n.crm.sb-collapsed .navgroup{margin-top:10px;padding-top:10px;border-top:1px solid var(--line-2)}\n.crm.sb-collapsed .navgroup:first-child{border-top:0;padding-top:0}\n.crm.sb-collapsed .me{justify-content:center;padding:12px 0 0}\n\n.main{min-width:0;display:flex;flex-direction:column;height:100dvh;overflow:hidden}\n.mtop{display:none}\n.head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;padding:26px 32px 0;flex-wrap:wrap}\n.head .date{color:var(--muted);font-size:var(--t-sm);font-weight:500}\n.head h1{font-size:var(--t-lg);font-weight:700;letter-spacing:-.4px;line-height:1.25}\n.headacts{display:flex;gap:8px;align-items:center}\n.aipill{display:inline-flex;align-items:center;gap:7px;height:40px;padding:0 12px;border-radius:var(--r-ctl);border:1px solid var(--line);background:var(--bg);font-size:var(--t-sm);font-weight:500;color:var(--ink2);white-space:nowrap}\n.aipill:hover{background:var(--hover)}\n.subnav{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 32px 0}\n.content{flex:1;min-height:0;padding:16px 32px 28px;overflow-y:auto}\n.content.leadmode{overflow:hidden}\n\n/* ===================== Inbox ===================== */\n.stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));padding:6px;gap:6px;margin-bottom:14px}\n.stat{display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:10px;min-width:0}\n.stat+.stat{box-shadow:-7px 0 0 -6px var(--line)}\n.stat .ic{width:34px;height:34px;border-radius:50%;background:var(--panel);display:grid;place-items:center;color:var(--ink2);flex:none}\n.stat b{display:block;font-size:20px;font-weight:650;color:var(--ink);line-height:1.15}\n.stat span.l{font-size:var(--t-xs);font-weight:500;color:var(--muted)}\n.filters{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px}\n.search{position:relative;flex:1 1 280px;max-width:420px;min-width:0}\n.search svg{position:absolute;left:12px;top:12px;color:var(--muted);pointer-events:none}\n.search .input{padding-left:38px}\n.search .input::-webkit-search-cancel-button{-webkit-appearance:none}\n.fsel{position:relative;display:inline-flex}\n.fsel .input{height:36px;font-size:var(--t-sm);width:auto;min-width:0}\n.fsel.on .input,.ftog.on,.filtbtn.on{background-color:oklch(0.6 0.11 185 / .1);border-color:oklch(0.6 0.11 185 / .55);box-shadow:inset 0 -2px 0 var(--teal);color:var(--ink);font-weight:600}\n.ftog{display:inline-flex;align-items:center;gap:8px;height:36px;padding:0 12px;border:1px solid var(--line);border-radius:var(--r-ctl);background:var(--bg);font-size:var(--t-sm);font-weight:500;color:var(--ink2);white-space:nowrap}\n.ftog .switch{transform:scale(.75);margin:0 -5px}\n.ftog.on .switch i{background:var(--teal)}\n.filtbtn{display:none;height:36px}\n.chipseg{display:inline-flex;gap:4px}\n.chipseg button{display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 12px;border-radius:var(--r-ctl);border:1px solid var(--line);background:var(--bg);font-size:var(--t-sm);font-weight:500;color:var(--ink2);white-space:nowrap}\n.chipseg button.on{background:var(--primary);color:#fff;border-color:transparent;font-weight:600}\n.chipseg button.on .count{background:rgb(255 255 255 / .18);color:#fff;border-color:transparent}\n.clear{border:0;background:none;padding:0 4px;color:var(--tealink);font-size:var(--t-sm);font-weight:600;text-decoration:underline;text-underline-offset:2px;white-space:nowrap}\n.listhead{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:2px 0 8px;font-size:var(--t-sm);color:var(--ink2)}\n.listhead b{color:var(--ink)}\n.lhr{display:flex;gap:10px;align-items:center}\n.refreshing{display:inline-flex;align-items:center;gap:6px;color:var(--ink2);font-size:var(--t-xs);font-weight:600}\n.tablebox{overflow-x:auto}\ntable{width:100%;border-collapse:collapse}\nth{background:var(--panel);text-align:left;font-size:var(--t-xs);font-weight:600;color:var(--muted);padding:9px 12px;border-bottom:1px solid var(--line-2);white-space:nowrap}\ntd{padding:11px 12px;border-bottom:1px solid var(--line-2);vertical-align:middle;font-size:var(--t-sm)}\ntbody tr{cursor:pointer;transition:background var(--fast) var(--ease)}\ntbody tr:hover td{background:rgb(0 0 0 / .02)}\ntr:last-child td{border-bottom:0}\ntr.sel td{background:oklch(0.975 0.003 95)}\ntd.c-lead{width:38%;max-width:0}\n.lead{display:flex;gap:11px;align-items:flex-start;min-width:0}\n.lead .t{min-width:0;flex:1}\n.lead .nm{display:flex;align-items:center;gap:7px;font-weight:600;color:var(--ink);font-size:var(--t-base);min-width:0}\n.lead .nm span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.lead .sub{display:block;color:var(--ink2);font-size:var(--t-sm);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.lead .subx{display:none;color:var(--muted);font-size:var(--t-xs);font-weight:500;margin-top:2px}\n.reasons{display:flex;gap:4px;flex-wrap:wrap;margin-top:5px}\n.unread{width:8px;height:8px;border-radius:50%;background:var(--blue);flex:none;display:inline-block}\n.reason{display:inline-flex;align-items:center;gap:4px;border-radius:var(--r-pill);padding:1px 8px;font-size:11px;font-weight:600;white-space:nowrap}\n.aim{display:inline-flex;align-items:center;gap:5px;font-size:var(--t-xs);font-weight:600;color:var(--ink2);white-space:nowrap}\n.time{font-size:var(--t-xs);font-weight:500;color:var(--muted);white-space:nowrap}\n.lnk{border:0;background:none;padding:0;color:var(--tealink);font-weight:600;text-decoration:none;font-size:var(--t-sm);text-align:left;cursor:pointer}\n.lnk:hover{text-decoration:underline;text-underline-offset:2px}\n.empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;text-align:center;padding:56px 24px;color:var(--ink2)}\n.empty .eic{width:52px;height:52px;border-radius:50%;background:var(--panel);display:grid;place-items:center;color:var(--ink2);margin-bottom:6px}\n.empty b{font-size:var(--t-md);color:var(--ink)}\n.mcards{display:none}\n\n/* compact list (when a lead is open) */\n.split{display:grid;grid-template-columns:400px minmax(0,1fr);gap:16px;height:100%;min-height:0}\n.listcol{display:flex;flex-direction:column;min-height:0}\n.listcol .filters{flex-wrap:nowrap}\n.listcol .search{max-width:none}\n.clist{display:flex;flex-direction:column;overflow-y:auto;min-height:0;flex:1}\n.crow{display:flex;gap:11px;padding:11px 12px;border-bottom:1px solid var(--line-2);position:relative;cursor:pointer;flex:none;background:none;border-left:0;border-right:0;border-top:0;text-align:left;width:100%}\n.crow:hover{background:rgb(0 0 0 / .02)}\n.crow.sel{background:oklch(0.975 0.003 95)}\n.crow.sel::before{content:\"\";position:absolute;left:0;top:10px;bottom:10px;width:3px;border-radius:0 3px 3px 0;background:var(--ink)}\n.crow .t{flex:1;min-width:0}\n.crow .l1{display:flex;align-items:center;gap:6px}\n.crow .l1 b{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--ink);font-weight:600}\n.crow .sub{display:block;font-size:var(--t-sm);color:var(--ink2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.crow .l3{display:flex;align-items:center;gap:6px;margin-top:5px;flex-wrap:wrap}\n\n/* ===================== Lead panel ===================== */\n.lpanel{display:grid;grid-template-columns:minmax(0,1fr) 352px;grid-template-rows:auto minmax(0,1fr);height:100%;min-height:0;overflow:hidden}\n.lph{grid-column:1 / -1;display:flex;align-items:center;gap:12px;padding:12px 14px 12px 16px;border-bottom:1px solid var(--line-2);min-width:0}\n.lph .t{flex:1;min-width:0}\n.lph .t b{display:block;font-size:var(--t-md);color:var(--ink);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.lph .t>span{display:flex;gap:10px;align-items:center;font-size:var(--t-xs);flex-wrap:wrap}\n.lph .back{display:none}\n.plseg{display:none;grid-column:1 / -1;padding:8px 12px;border-bottom:1px solid var(--line-2)}\n.pseg{display:grid;grid-template-columns:repeat(3,1fr);background:var(--panel);border-radius:12px;padding:3px}\n.pseg.two{grid-template-columns:1fr 1fr}\n.pseg button{display:flex;align-items:center;justify-content:center;height:36px;border:0;background:none;border-radius:9px;font-size:var(--t-sm);font-weight:500;color:var(--ink2)}\n.pseg button.on{background:#fff;color:var(--ink);font-weight:600;box-shadow:0 0 0 1px var(--line)}\n.thread{display:flex;flex-direction:column;min-height:0;border-right:1px solid var(--line-2)}\n.msgs{flex:1;min-height:0;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:4px}\n.msgs>:first-child{margin-top:0}\n.daysep{align-self:center;font-size:11px;font-weight:600;color:var(--muted);margin:4px 0 8px}\n.bub{max-width:82%;padding:9px 13px;border-radius:16px;font-size:var(--t-sm);line-height:1.45;color:var(--ink);white-space:pre-wrap;overflow-wrap:anywhere}\n.bub.out{align-self:flex-end;background:oklch(0.94 0.004 285);border-bottom-right-radius:6px}\n.bub.in{align-self:flex-start;background:#fff;border:1px solid var(--line);border-bottom-left-radius:6px}\n.bmeta{font-size:11px;font-weight:500;color:var(--muted);margin:2px 4px 10px;display:inline-flex;align-items:center;gap:5px}\n.bmeta.r{align-self:flex-end} .bmeta.l{align-self:flex-start}\n.draft{margin:0 16px 10px;border-radius:14px;border:1.5px dashed oklch(0.6 0.14 65 / .55);background:oklch(0.6 0.14 65 / .06);padding:12px 14px;flex:none}\n.draft .dh{display:flex;align-items:center;gap:8px;font-size:var(--t-xs);font-weight:600;color:var(--amberink);margin-bottom:6px}\n.draft .dh .meta{margin-left:auto}\n.draft p{margin:0 0 10px;font-size:var(--t-sm);color:var(--ink);white-space:pre-wrap;overflow-wrap:anywhere;max-height:180px;overflow-y:auto}\n.draft textarea.input{margin-bottom:10px;min-height:96px}\n.draft .da{display:flex;gap:6px;flex-wrap:wrap}\n.fup{display:flex;align-items:center;gap:10px;margin:0 16px 10px;padding:10px 12px;border-radius:12px;background:var(--panel);font-size:var(--t-sm);color:var(--ink);flex:none;flex-wrap:wrap}\n.fup span{flex:1;min-width:140px}\n.composer{display:flex;gap:8px;align-items:flex-end;padding:10px 16px 14px;border-top:1px solid var(--line-2);flex:none}\n.composer .input{min-height:44px;height:44px;max-height:180px;border-radius:22px;padding:11px 16px;resize:none;overflow-y:auto}\n.sendbtn{width:44px;height:44px;border-radius:50%;background:var(--primary);color:#fff;border:0;display:grid;place-items:center;flex:none}\n.sendbtn.off{background:oklch(0.85 0.005 285);pointer-events:none}\n.firsttext{margin:auto;max-width:340px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:8px}\n.firsttext .btns{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:4px}\n.details{overflow-y:auto;min-height:0;padding:14px 16px 20px;display:flex;flex-direction:column;gap:12px;background:#fff}\n.dsec{border:1px solid var(--line);border-radius:14px;padding:12px 14px;flex:none}\n.dsec h5{font-size:var(--t-xs);font-weight:600;color:var(--ink2);margin:0 0 8px;display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:32px}\n.dsec.hl{background:var(--panel);border-color:transparent}\n.kv{display:grid;grid-template-columns:110px minmax(0,1fr);gap:7px 10px;font-size:var(--t-sm);margin:0}\n.kv dt{color:var(--muted);font-weight:500}\n.kv dd{margin:0;color:var(--ink);font-weight:500;min-width:0;overflow-wrap:anywhere}\n.phv{display:flex;align-items:center;gap:2px;flex-wrap:wrap}\n.phv .iconbtn{width:28px;height:28px}\n.phedit{display:flex;gap:6px;flex-wrap:wrap}\n.phedit .input{flex:1 1 140px;height:36px}\n.two{display:grid;grid-template-columns:1fr 1fr;gap:10px}\n.two .full{grid-column:1 / -1}\n.aiseg{display:grid;grid-template-columns:1fr 1fr;background:var(--panel);border-radius:10px;padding:3px}\n.aiseg.three{grid-template-columns:repeat(3,1fr)}\n.aiseg button{display:flex;align-items:center;justify-content:center;height:32px;border:0;background:none;border-radius:8px;font-size:var(--t-sm);font-weight:500;color:var(--ink2)}\n.aiseg button.on{background:#fff;color:var(--ink);font-weight:600;box-shadow:0 0 0 1px var(--line)}\n.aiexp{font-size:var(--t-xs);color:var(--ink2);margin-top:6px}\n.setrow{display:flex;align-items:center;gap:12px;justify-content:space-between}\n.setrow b{display:block;color:var(--ink);font-weight:600}\n.steps{list-style:none;margin:0;padding:0}\n.steps li{display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--line-2);font-size:var(--t-sm);color:var(--ink);flex-wrap:wrap}\n.steps li:last-child{border-bottom:0}\n.steps li>span:nth-child(2){flex:1;min-width:120px}\n.steps li.done>span:nth-child(2){color:var(--muted);text-decoration:line-through}\n.cbx{width:18px;height:18px;border-radius:6px;border:1.5px solid rgb(0 0 0 / .28);flex:none;display:grid;place-items:center}\n.cbx.on{background:var(--primary);border-color:transparent;color:#fff}\n.warnbox{display:flex;gap:8px;align-items:flex-start;padding:9px 11px;border-radius:10px;background:oklch(0.6 0.14 65 / .12);color:var(--ink);font-size:var(--t-sm);margin-top:8px;text-align:left}\n.warnbox svg{color:var(--amberink);margin-top:2px}\n.warnbox b{color:var(--amberink)}\n.okbox{display:flex;gap:8px;align-items:center;padding:9px 11px;border-radius:10px;background:oklch(0.6 0.13 155 / .1);font-size:var(--t-sm);color:var(--ink);margin-top:8px}\n.okbox svg{color:var(--greenink)}\n.menu{position:fixed;z-index:95;width:250px;border-radius:14px;padding:6px}\n.menu button{display:flex;align-items:center;gap:10px;width:100%;height:40px;padding:0 10px;border:0;background:none;border-radius:9px;font-size:var(--t-sm);font-weight:500;color:var(--ink);text-align:left}\n.menu button:hover{background:var(--press)}\n.menu button.dng{color:var(--redink)}\n.menu hr{border:0;border-top:1px solid var(--line-2);margin:4px 6px}\n\n/* ===================== Knowledge + Settings ===================== */\n.kaddgrid{display:grid;grid-template-columns:1fr 1.4fr;gap:14px}\n.drop{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;border:1.5px dashed rgb(0 0 0 / .2);border-radius:12px;min-height:150px;font-weight:600;color:var(--ink);cursor:pointer;text-align:center;padding:12px;transition:background var(--fast) var(--ease)}\n.drop:hover{background:var(--hover)}\n.drop.busy{opacity:.6;pointer-events:none}\n.kpaste{display:flex;flex-direction:column;gap:8px}\n.kpaste textarea.input{min-height:74px}\n.kphone{display:none;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px}\n.krow{display:grid;grid-template-columns:36px minmax(0,1fr) 190px 120px 40px;gap:12px;align-items:center;padding:12px 16px;border-bottom:1px solid var(--line-2)}\n.krow:last-child{border-bottom:0}\n.kic{width:36px;height:36px;border-radius:10px;background:var(--panel);display:grid;place-items:center;color:var(--ink2)}\n.kmain{border:0;background:none;padding:0;text-align:left;min-width:0;cursor:pointer}\n.kmain b{display:block;color:var(--ink);font-weight:600;font-size:var(--t-sm);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.kmain .meta{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.kst{display:inline-flex;align-items:center;gap:7px;font-size:var(--t-xs);font-weight:600;border:0;background:none;padding:0;text-align:left}\n.kst.ok{color:var(--greenink);cursor:pointer}\n.kst.bad{color:var(--redink)}\n.kst.wait{color:var(--ink2)}\n.kst .btn{height:26px}\n.kact{display:flex;align-items:center;gap:8px;font-size:var(--t-xs);font-weight:500}\n.cardhead{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border-bottom:1px solid var(--line-2);flex-wrap:wrap}\n.cardhead h3{font-size:var(--t-md);font-weight:600;display:flex;align-items:center;gap:8px}\n.cardbody{padding:14px 16px}\n.setgrid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px;align-items:start}\n.setcol{display:flex;flex-direction:column;gap:16px;min-width:0}\n.setrow-top{align-items:flex-start}\n.setrow-top .setcopy{flex:1;min-width:0;padding-right:8px}\n.setrow-top .setcopy .meta{display:block;margin-top:4px;line-height:1.45}\n.paste-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}\n.paste-actions .btn{width:100%}\n.code-label{display:block;margin-top:2px}\n.people li .t .code{display:inline-block}\n.btn.primary:not([disabled]):not(.dis){opacity:1}\n.stats{gap:2px;padding:4px;margin-bottom:12px}\n.stat b{font-size:15px;font-weight:650;letter-spacing:-.2px}\n.stat{padding:6px 8px;gap:8px}\n.stat .ic{width:26px;height:26px}\n.stat span.l{font-size:11px}\n.kadd-head{display:flex;flex-direction:column;align-items:flex-start;gap:4px}\n.kadd-head .meta{margin:0}\n.details{overflow-x:hidden;overflow-wrap:anywhere}\n.details .two>.field{min-width:0}\n.details select.input{max-width:100%;min-width:0}\n.ph-muted{color:var(--muted);font-weight:500}\n.input.ph{border-color:transparent;background:transparent;box-shadow:none;padding-left:0;color:var(--muted);font-weight:500}\n.input.ph:focus{border-color:oklch(0.6 0.15 255 / .6);background:var(--bg);box-shadow:0 0 0 3px oklch(0.6 0.15 255 / .12);padding-left:12px;color:var(--ink);font-weight:500}\n.input.ph::placeholder{color:var(--muted);font-weight:500}\n.msgs{scroll-padding-top:8px}\n.msgs>:first-child{margin-top:0}\n.crow{min-height:72px;align-items:center}\n.crow .l3{flex-wrap:nowrap;overflow:hidden}\n.crow .l3 .reason,.crow .l3 .chip,.crow .l3 .aim{flex:none}\n.warnbox{overflow-wrap:anywhere;align-items:flex-start}\n.warnbox>span{min-width:0;flex:1;overflow-wrap:anywhere}\n.ptable{width:100%;border:1px solid var(--line-2);border-radius:12px;overflow:hidden;font-size:var(--t-sm);margin:0}\n.ptable div{display:grid;grid-template-columns:120px minmax(0,1fr);gap:10px;padding:8px 12px;border-bottom:1px solid var(--line-2)}\n.ptable div:last-child{border-bottom:0}\n.ptable dt{color:var(--muted);font-weight:500}\n.ptable dd{margin:0;color:var(--ink);font-weight:500;overflow-wrap:anywhere}\n.people{list-style:none;margin:0;padding:0}\n.people li{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--line-2);font-size:var(--t-sm);flex-wrap:wrap}\n.people li:last-child{border-bottom:0}\n.people li .t{flex:1;min-width:0}\n.people li .t b{display:block;color:var(--ink);font-weight:600;overflow-wrap:anywhere}\n.addrow{display:grid;grid-template-columns:1fr 1fr auto;gap:8px;margin-top:10px}\n.code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:var(--t-sm);font-weight:600;color:var(--ink);letter-spacing:.5px;margin-right:10px}\n.pastebox{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:1.55;color:var(--ink2);white-space:pre-wrap}\n.editor{width:560px;max-width:100%;padding:24px;border-radius:20px 0 0 20px;display:flex;flex-direction:column;gap:12px;overflow:auto}\n.editor .edhead{display:flex;align-items:center;justify-content:space-between}\n.editor .edhead h2{font-size:20px;font-weight:650}\n.editor textarea.input{min-height:360px;flex:1}\n.editor .mfoot{margin-top:4px}\n\n/* ===================== Ctrl+K ===================== */\n.cmdk{width:600px;max-width:100%;border-radius:18px;overflow:hidden}\n.cmdq{display:flex;align-items:center;gap:10px;padding:0 16px;border-bottom:1px solid var(--line-2);height:54px}\n.cmdq input{flex:1;min-width:0;border:0;outline:none;background:none;font-size:var(--t-md);color:var(--ink)}\n.cmdres{padding:8px;max-height:60vh;overflow-y:auto}\n.cmdres .grp{padding:8px 10px 4px}\n.cmdres .it{display:flex;align-items:center;gap:12px;width:100%;min-height:46px;padding:0 10px;border:0;background:none;border-radius:10px;text-align:left;color:var(--ink);font-weight:500}\n.cmdres .it.act{background:var(--press)}\n.cmdres .it .meta{margin-left:auto;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:55%}\n\n/* ===================== Phone chrome ===================== */\n.bottomnav,.fab{display:none}\n\n/* ===================== Breakpoints =====================\n   1240 and up: full table, compact list + panel with thread and details side by side, two-column settings.\n   900 to 1239: table folds Plan and Contract into the lead subtitle; the panel takes the main area with Chat and Details tabs.\n   768 to 899: sidebar is an icon rail; filters move into a Filters button and sheet; knowledge add area stacks.\n   Below 768: phone layout with bottom nav, + Lead button, cards instead of rows, sheets for forms. */\n@media (max-width:1239px){\n  th.c-plan,th.c-contract,td.c-plan,td.c-contract{display:none}\n  .lead .subx{display:block}\n  .split{grid-template-columns:minmax(0,1fr)}\n  .listcol{display:none}\n  .lpanel{grid-template-columns:minmax(0,1fr);grid-template-rows:auto auto minmax(0,1fr)}\n  .plseg{display:block}\n  .lpanel.t-chat .details{display:none}\n  .lpanel.t-details .thread{display:none}\n  .thread{border-right:0}\n  .lph .back{display:inline-grid}\n  .lph .closex{display:none}\n  .details{padding:14px 16px 24px}\n  .setgrid{grid-template-columns:minmax(0,1fr)}\n  .head{padding:24px 24px 0}\n  .subnav{padding:16px 24px 0}\n  .content{padding:16px 24px 28px}\n}\n@media (max-width:899px){\n  .app{--sw:68px}\n  .side{padding-left:10px;padding-right:10px}\n  .side .brand{flex-direction:column;gap:12px;padding:0}\n  .side .brand b,.side .nl,.side kbd,.navgroup h4,.sidetog{display:none}\n  .jump{justify-content:center;padding:0}\n  .nav button{justify-content:center;padding:0;gap:0}\n  /* active pill only */\n  .navgroup{margin-top:10px;padding-top:10px;border-top:1px solid var(--line-2)}\n  .navgroup:first-child{border-top:0;padding-top:0}\n  .me{justify-content:center;padding:12px 0 0}\n  .filters .fsel,.filters .ftog,.filters .clear{display:none}\n  .filtbtn{display:inline-flex}\n  .kaddgrid{grid-template-columns:1fr}\n  .krow{grid-template-columns:36px minmax(0,1fr) auto 40px}\n  .krow .kst{grid-column:2 / 3;grid-row:2}\n  .krow .kact{grid-column:3 / 4}\n}\n@media (max-width:767px){\n  .app{display:block;height:auto}\n  .side{display:none}\n  .main{height:auto;overflow:visible}\n  .mtop{display:flex;align-items:center;justify-content:space-between;gap:8px;height:calc(52px + var(--safe-t));padding:var(--safe-t) 12px 0 16px;position:sticky;top:0;background:rgb(255 255 255 / .96);border-bottom:1px solid var(--line-2);z-index:30}\n  .mtop .brand{padding:0}\n  .mtop .brand img{width:30px;height:30px}\n  .mtop .iconbtn{width:44px;height:44px}\n  .head{padding:12px 16px 0;align-items:center;flex-wrap:nowrap}\n  .head .date{display:none}\n  .head h1{font-size:22px;letter-spacing:-.3px}\n  .head .addbtn{display:none}\n  .aipill{height:34px}\n  .subnav{padding:10px 16px 0}\n  .subnav .seg{display:grid;grid-template-columns:repeat(3,1fr);width:100%;border:0;border-radius:12px}\n  .subnav .seg button{height:36px;padding:0 6px}\n  .subnav .seg svg{display:none}\n  .content{padding:12px 16px calc(150px + var(--safe-b));overflow:visible}\n  .content.leadmode{overflow:visible}\n  .stats{display:none}\n  .filters{gap:6px;margin-bottom:10px}\n  .search{flex:1 1 100%;max-width:none}\n  .listhead{margin-bottom:10px}\n  .listhead .meta{display:none}\n  .listcard{border:0;background:none;border-radius:0}\n  .tablebox{display:none}\n  .mcards{display:block}\n  .mcard{display:block;width:100%;text-align:left;border:1px solid var(--line);border-radius:16px;padding:12px 14px;margin-bottom:10px;background:#fff;cursor:pointer}\n  .mcard .l1{display:flex;align-items:center;gap:7px}\n  .mcard .l1 b{flex:1;min-width:0;color:var(--ink);font-weight:600;font-size:var(--t-base);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n  .mcard .sub{display:block;font-size:var(--t-sm);color:var(--ink2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin:2px 0 8px}\n  .mcard .chips{display:flex;gap:5px;flex-wrap:wrap;align-items:center}\n  .mcard .ml{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:8px;padding-top:8px;border-top:1px solid var(--line-2);font-size:var(--t-xs);font-weight:500}\n  .mcard .ml>span:first-child{display:flex;gap:6px;align-items:center;flex-wrap:wrap;min-width:0}\n  .btn{height:44px}\n  .btn.sm{height:38px}\n  .iconbtn{width:44px;height:44px}\n  .input{height:44px;font-size:16px}\n  .fsel .input{height:44px}\n  .chipseg button,.filtbtn{height:44px}\n  textarea.input{font-size:16px}\n  /* one lead: full screen with Chat and Details tabs */\n  .split{display:block;height:auto}\n  .lpanel{position:fixed;inset:0;z-index:70;border:0;border-radius:0;background:#fff;height:100dvh;padding-top:var(--safe-t)}\n  .lph{height:60px;padding:0 8px;gap:8px}\n  .lph .t b{font-size:var(--t-base)}\n  .lph .t>span .meta,.lph .t>span .chip{display:none}\n  .lph .bd{border-color:transparent}\n  .msgs{padding:12px}\n  .draft,.fup{margin:0 12px 8px}\n  .composer{padding:8px 12px calc(12px + var(--safe-b))}\n  .composer .input{font-size:16px}\n  .details{padding:12px 12px calc(24px + var(--safe-b))}\n  .kv{grid-template-columns:100px minmax(0,1fr)}\n  .two{grid-template-columns:1fr}\n  /* knowledge + settings */\n  .kadd{display:none}\n  .kphone{display:grid}\n  .krow{grid-template-columns:36px minmax(0,1fr) 44px;row-gap:6px;padding:12px}\n  .krow .kst{grid-column:2 / -1;grid-row:auto}\n  .krow .kact{grid-column:2 / -1}\n  .setgrid,.setcol{gap:12px}\n  .addrow{grid-template-columns:1fr}\n  /* forms and sheets */\n  .scrim:not(.top){align-items:flex-end;justify-content:center;padding:0}\n  .modal,.modal.narrow,.editor{width:100%;max-width:none;border-radius:20px 20px 0 0;max-height:94dvh;padding:20px 18px calc(20px + var(--safe-b))}\n  .editor textarea.input{min-height:300px}\n  .modal .mfoot,.editor .mfoot{position:sticky;bottom:calc(-20px - var(--safe-b));margin:16px -18px calc(-20px - var(--safe-b));padding:12px 18px calc(16px + var(--safe-b));background:rgb(255 255 255 / .94);border-top:1px solid var(--line-2)}\n  .modal .mfoot .btn,.editor .mfoot .btn{flex:1;height:48px}\n  .fgrid{grid-template-columns:1fr}\n  .scrim.top{padding:calc(12px + var(--safe-t)) 10px 10px}\n  .toast{bottom:calc(140px + var(--safe-b))}\n  .crm.lead-open .toast{bottom:calc(90px + var(--safe-b))}\n  .bottomnav{display:flex;position:fixed;left:0;right:0;bottom:0;background:rgb(255 255 255 / .96);border-top:1px solid var(--line);z-index:50;padding:4px 6px calc(4px + var(--safe-b))}\n  .bottomnav button{flex:1;border:0;background:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;font-size:11px;font-weight:500;color:var(--ink2);min-height:52px;border-radius:12px;min-width:0}\n  .bottomnav button:active{background:var(--press)}\n  .bottomnav button.active{color:var(--ink);font-weight:600;background:rgb(0 0 0 / .045);box-shadow:inset 0 0 0 1px rgb(0 0 0 / .1)}\n  .bottomnav button.active svg.i{stroke-width:2.1}\n  .fab{display:inline-flex;position:fixed;right:16px;bottom:calc(76px + var(--safe-b));z-index:55;height:52px;padding:0 20px;border-radius:var(--r-pill);font-size:var(--t-base);box-shadow:0 6px 20px rgb(0 0 0 / .18)}\n  .crm.lead-open .bottomnav,.crm.lead-open .fab,.crm.no-fab .fab{display:none}\n}\n@media (prefers-reduced-motion:reduce){*{animation:none!important;transition-duration:1ms!important}}\n\n/* Embedded in HubShell — hide duplicate product chrome */\n.crm.embed .side,.crm.embed .bottomnav,.crm.embed .mtop{display:none!important}\n/* Phone: the header + Lead button is hidden, so keep the floating one, above the hub's bottom nav. */\n@media (max-width:767px){.crm.embed .fab{bottom:calc(88px + var(--safe-b))}}\n.crm.embed .app{display:block;height:100%;min-height:0;grid-template-columns:none}\n/* The page never had a height, so it grew to fit every lead and the hub clipped it: nothing could scroll. Fill the\n   hub's pane and let the page's own content area scroll. */\n.crm.embed{height:100%;min-height:0}\n.crm.embed .main{height:100%;min-height:0}\n@media (max-width:767px){.crm.embed .main{overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}.crm.embed .content{height:auto;flex:none}}\n:host{height:100%;min-height:0}";


/** Welcome messages + booking cards (mrg-crm-welcome-booking_1.html). Appended so CRM_CSS stays untouched. */
export const CRM_EXTRA_CSS = `
.wmhead{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:16px}
.wmhead h2{font-size:20px;font-weight:650}
.wmhead p{margin:4px 0 0;max-width:640px;font-size:var(--t-sm);color:var(--ink2)}
.tpls{display:flex;flex-direction:column;gap:12px;max-width:900px}
.tpl{background:#fff;border:1px solid var(--line);border-radius:var(--r-card);padding:16px 18px}
.tpl .r1{display:flex;align-items:center;gap:8px}
.tpl .r1 b{font-size:var(--t-md);color:var(--ink);font-weight:650}
.tpl .r1 .sp{flex:1}
.defbadge{display:inline-flex;align-items:center;height:22px;padding:0 9px;border-radius:99px;background:var(--panel);border:1px solid var(--line);font-size:11px;font-weight:600;color:var(--ink2)}
.trig{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:8px;font-size:var(--t-sm);color:var(--ink2)}
.tplchip{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 10px;border-radius:99px;border:1px solid var(--line);background:#fff;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;font-weight:600;color:var(--ink)}
.tplchip.def{background:var(--panel);color:var(--muted);font-family:Inter,sans-serif;font-weight:500;cursor:default;border-color:var(--line-2)}
.tpl .msg{margin:12px 0 0;padding:10px 12px;border-radius:12px;background:var(--panel);font-size:var(--t-sm);color:var(--ink);line-height:1.5;white-space:pre-wrap}
.tpl .stop{font-size:var(--t-xs);color:var(--muted);font-weight:500;margin-top:6px}
.tpl .acts{display:flex;gap:6px;justify-content:flex-end;margin-top:10px}
.btn.ghostred{border-color:transparent;background:none;color:var(--ink2)}
.btn.ghostred:hover{background:oklch(0.6 0.19 25 / .1);color:var(--redink)}
.tpl .ask{display:flex;align-items:center;gap:8px;justify-content:flex-end;margin-top:10px;padding:8px 10px;border-radius:10px;background:oklch(0.6 0.19 25 / .08);font-size:var(--t-sm);color:var(--ink)}
.tpl .ask span{flex:1}
.mhead{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
.mform{display:flex;flex-direction:column;gap:14px}
.taw{position:relative}
.taw textarea{padding-bottom:26px}
.cc{position:absolute;right:10px;bottom:7px;font-size:11px;font-weight:600;color:var(--muted);font-variant-numeric:tabular-nums}
.cc.over{color:var(--amberink)}
.prev{border-radius:12px;background:var(--panel);padding:10px 12px}
.prev .pl{font-size:11px;font-weight:700;color:var(--muted);letter-spacing:.3px;text-transform:uppercase;margin-bottom:6px}
.prev .pb{display:inline-block;max-width:92%;background:oklch(0.94 0.004 285);border-radius:16px 16px 6px 16px;padding:9px 13px;font-size:var(--t-sm);color:var(--ink);line-height:1.45;white-space:pre-wrap}
.prev .pb .s{color:var(--muted)}
.prev .pb mark{background:oklch(0.6 0.11 185 / .18);color:var(--ink);border-radius:4px;padding:0 2px}
.bkdone{align-self:center;width:340px;max-width:90%;background:#fff;border:1px solid var(--line);border-left:3px solid #22c55e;border-radius:10px;padding:12px 14px;margin:6px 0 10px;color:var(--ink)}
.bkdone .ok{color:#16a34a;font-weight:600;font-size:var(--t-sm)}
.bkdone .when{font-size:18px;font-weight:650;letter-spacing:-.2px;margin:4px 0 2px}
.bkdone .w2{font-size:var(--t-sm);color:var(--ink2)}
.bkdone .w3{font-size:var(--t-xs);color:var(--muted);font-weight:500;margin-top:6px}
.bkdone a{display:inline-block;margin-top:8px;color:var(--tealink);font-weight:600;font-size:var(--t-sm);text-decoration:none}
.bkdone a:hover{text-decoration:underline}
.bkdone .bkacts{display:flex;flex-wrap:wrap;gap:12px 16px;align-items:center;margin-top:4px}
.bkdone .bkacts a{margin-top:8px}
/* Book a call picker (mrg-crm-booking-picker.html) */
.booksec h5{margin-bottom:10px}
.booksec h5 span{font-size:var(--t-sm);color:var(--ink);font-weight:650}
.bnote{font-size:var(--t-xs);color:var(--muted);font-weight:500;margin-bottom:8px}
.days{display:flex;gap:6px;overflow-x:auto;padding:2px;scrollbar-width:none}
.days::-webkit-scrollbar{display:none}
.dpill{flex:none;width:48px;display:flex;flex-direction:column;align-items:center;gap:0;padding:6px 0 7px;border-radius:12px;border:1px solid var(--line);background:#fff;color:var(--ink);font-family:inherit;cursor:pointer;transition:background var(--fast) var(--ease),border-color var(--fast) var(--ease)}
.dpill span{font-size:11px;font-weight:600;color:var(--ink2);line-height:1.2}
.dpill b{font-size:16px;font-weight:650;line-height:1.25}
.dpill .mo{font-size:10px;font-weight:500;color:var(--muted)}
.dpill:hover:not(.on){border-color:rgb(0 0 0 / .3)}
.dpill.on{background:var(--primary);border-color:var(--primary);color:#fff}
.dpill.on span,.dpill.on .mo{color:rgb(255 255 255 / .8)}
.selwrap{margin-top:10px}
.selwrap select{width:100%;cursor:pointer}
.bmeta2{font-size:var(--t-xs);color:var(--muted);font-weight:500;margin-top:6px}
.bookbtn{width:100%;margin-top:10px;justify-content:space-between;height:auto;min-height:40px;padding:8px 14px}
.bookbtn[disabled]{background:oklch(0.85 0.005 285);color:#fff;opacity:1;pointer-events:none}
.bookbtn .bl{display:flex;flex-direction:column;align-items:flex-start;gap:1px;text-align:left}
.bookbtn .bs{font-size:11px;font-weight:500;opacity:.8}
.ccard2{border:1px solid var(--line);border-radius:12px;padding:12px}
.ccr{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.ccr b{color:var(--ink);font-size:var(--t-sm)}
.okc{width:24px;height:24px;border-radius:50%;background:var(--green);color:#fff;display:grid;place-items:center;flex:none}
.okc svg{width:14px;height:14px;stroke-width:2.4}
.cdl{display:flex;flex-direction:column;gap:2px;margin:0 0 12px;font-size:var(--t-sm)}
.cdl dd+dt{margin-top:6px}
.cdl dt{color:var(--muted);font-weight:500;font-size:var(--t-xs);padding-top:2px}
.cdl dd{margin:0;color:var(--ink);font-weight:500;overflow-wrap:anywhere}
.cbtns{display:flex;gap:8px}
.cbtns .btn{flex:1}
.bkdone2{background:#fff;border:1px solid var(--line);border-left:3px solid var(--green);border-radius:10px;padding:12px 14px;color:var(--ink)}
.bkdone2 .ok{color:var(--greenink);font-weight:700;font-size:var(--t-sm)}
.bkdone2 .when{font-size:17px;font-weight:650;margin:3px 0 2px}
.bkdone2 .w2{font-size:var(--t-sm);color:var(--muted)}
.bkdone2 .w3{font-size:var(--t-xs);color:var(--muted);font-weight:500;margin-top:6px}
.bkdone2 .nt{color:var(--greenink);font-weight:600}
.blinks{display:flex;align-items:center;gap:6px;margin-top:10px;font-size:var(--t-xs);flex-wrap:wrap;white-space:nowrap;row-gap:4px}
.blinks .lnk{font-size:var(--t-sm)}
.blinks .sp{flex-basis:100%;height:0}
.dotsep{color:var(--muted)}
.lnkm{background:none;border:0;padding:2px 0;font:500 var(--t-xs)/1.2 Inter,sans-serif;color:var(--muted);cursor:pointer}
.lnkm:hover{color:var(--ink);text-decoration:underline}
.askc{margin-top:10px;padding:10px 12px;border-radius:10px;background:oklch(0.6 0.19 25 / .07);border:1px solid oklch(0.6 0.19 25 / .2);display:flex;flex-direction:column;gap:4px;font-size:var(--t-sm);color:var(--ink)}
.askc span{font-size:var(--t-xs);color:var(--ink2)}
.askc .cbtns{margin-top:6px}
.btn.redtxt{color:var(--redink);font-weight:600;border-color:var(--line);background:none}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
/* CRM contract send (mrg-crm-contract.html) */
.ks .two select{font-size:12px;padding-left:10px;padding-right:28px;background-position:right 8px center}
.kbody{margin-top:12px}
.btn.wide{width:100%}
.btn.big{height:46px;font-size:var(--t-base);margin-top:12px}
.icard{border:1px solid var(--line);border-radius:12px;padding:12px;background:#fff}
.ih{font-size:var(--t-sm);font-weight:650;color:var(--ink);margin-bottom:8px}
.tplrow{display:flex;align-items:center;gap:10px;width:100%;text-align:left;padding:9px 10px;border:1px solid var(--line-2);border-radius:10px;background:#fff;margin-bottom:6px;cursor:pointer;font:inherit;transition:background var(--fast) var(--ease),border-color var(--fast) var(--ease)}
.tplrow:hover{background:var(--hover);border-color:rgb(0 0 0 / .2)}
.tplrow .t{flex:1;min-width:0}
.tplrow b{display:block;font-size:var(--t-sm);color:var(--ink);font-weight:600}
.tplrow .t span{font-size:var(--t-xs);color:var(--muted);font-weight:500}
.tplrow .sel{font-size:var(--t-xs);font-weight:600;color:var(--tealink);white-space:nowrap}
.rdl{display:grid;grid-template-columns:70px 1fr;gap:4px 10px;margin:0;font-size:var(--t-sm)}
.rdl dt{color:var(--muted);font-size:var(--t-xs);font-weight:500;padding-top:2px}
.rdl dd{margin:0;color:var(--ink);font-weight:500;overflow-wrap:anywhere}
.ccardk{border:1px solid var(--line);border-left:3px solid var(--green);border-radius:10px;padding:12px 14px;background:#fff;color:var(--ink)}
.ccardk .kt{font-weight:700;font-size:var(--t-sm);color:var(--ink)}
.ccardk .kt.ok{color:var(--greenink)}
.ccardk .kn{font-size:16px;font-weight:650;margin:3px 0 2px}
.ccardk .km{font-size:var(--t-xs);color:var(--muted);font-weight:500}
.kaw{display:flex;align-items:center;gap:6px;margin-top:8px;font-size:var(--t-xs);font-weight:600;color:var(--amberink)}
.klinks{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:8px;font-size:var(--t-sm)}
.klinks .lnk{font-size:var(--t-sm)}
.klinks .sp{flex:1}
.cnote2{font-size:var(--t-xs);color:var(--muted);font-weight:500;margin-bottom:8px}
.okbox .okc{width:20px;height:20px;border-radius:50%;background:var(--green);color:#fff;display:grid;place-items:center;flex:none}
@media (max-width:768px){.days{flex-wrap:wrap;overflow:visible}.bookbtn,.cbtns .btn{min-height:44px}.ks .two{grid-template-columns:1fr}.btn.wide{min-height:46px}}
@media (max-width:767px){
  .subnav .seg{grid-template-columns:repeat(4,minmax(0,1fr))}
  .wmhead{flex-direction:column;align-items:stretch}
  .wmhead .btn.primary{width:100%}
}

/* Call UI (mrg-crm-calls_2.html) */
.callsec{padding:12px 14px;border:1px solid var(--line);border-radius:14px}
.callsec .r1{display:flex;align-items:center;gap:8px}
.callsec .r1 .lab{flex:1;font-size:var(--t-xs);color:var(--muted);font-weight:500;min-width:0}
.callsec .r1 .lab b{color:var(--ink);font-weight:600}
.callsec .tm{font-weight:700;color:var(--ink);font-variant-numeric:tabular-nums;font-size:var(--t-base)}
.callsec .r2{display:flex;gap:6px;margin-top:8px}
.callsec .r2 .btn{flex:1}
.btn.endcall{border-color:var(--line);background:none;color:var(--redink);font-weight:600}
.btn.endcall:hover{background:oklch(0.6 0.19 25 / .08)}
.lnkbtn{background:none;border:0;color:var(--tealink);font:600 var(--t-sm)/1 Inter,sans-serif;padding:6px 0;cursor:pointer;text-decoration:underline;text-underline-offset:2px}
.cdot{width:9px;height:9px;border-radius:50%;flex:none;position:relative}
.cdot::after{content:"";position:absolute;inset:-4px;border-radius:50%;background:currentColor;opacity:0;animation:cpulse 1.4s ease-in-out infinite}
.cdot.red{background:var(--red);color:var(--red)}.cdot.amber{background:var(--amber);color:var(--amber)}.cdot.green{background:var(--green);color:var(--green)}
.cdot.green::after,.cdot.grey::after{animation:none}.cdot.grey{background:oklch(0.75 0.005 285)}
@keyframes cpulse{0%{transform:scale(.6);opacity:.45}70%,100%{transform:scale(1.5);opacity:0}}
.sumbox{position:relative;background:var(--panel);border-radius:8px;padding:12px;font-size:var(--t-sm);color:var(--ink);line-height:1.5;white-space:pre-wrap}
.sumbox p{margin:0;padding-right:30px}
.edl{position:absolute;top:9px;right:10px;background:none;border:0;color:var(--tealink);font:600 var(--t-xs)/1 Inter,sans-serif;cursor:pointer;padding:2px}
.edl:hover{text-decoration:underline}
.sumedit textarea{min-height:110px}
.sumedit .r{display:flex;justify-content:flex-end;gap:6px;margin-top:6px}
.disc{display:flex;align-items:center;justify-content:space-between;width:100%;background:none;border:0;padding:10px 0 6px;font:600 var(--t-xs)/1 Inter,sans-serif;color:var(--ink2);cursor:pointer}
.disc:hover{color:var(--ink)}
.disc svg{transition:transform var(--med) var(--ease)}
.disc[aria-expanded="true"] svg{transform:rotate(180deg)}
.trwrap{display:grid;grid-template-rows:0fr;transition:grid-template-rows var(--med) var(--ease)}
.trwrap.open{grid-template-rows:1fr}
.trwrap>div{overflow:hidden}
.trbox{max-height:200px;overflow-y:auto;background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:10px;font:12px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--ink);white-space:pre-wrap}
.reclab{font-size:var(--t-xs);font-weight:600;color:var(--ink2);margin:12px 0 6px}
.player{display:flex;align-items:center;gap:8px;background:var(--panel);border-radius:8px;padding:8px 10px}
.pbtn{width:28px;height:28px;border-radius:50%;border:0;background:var(--primary);color:#fff;display:grid;place-items:center;flex:none;cursor:pointer}
.pbtn svg{width:11px;height:11px;fill:currentColor;stroke:none}
.prog{flex:1;height:4px;border-radius:2px;background:oklch(0.86 0.004 285);position:relative;cursor:pointer}
.prog i{position:absolute;left:0;top:0;bottom:0;border-radius:2px;background:var(--ink);width:0%}
.pdur{font-size:var(--t-xs);font-weight:600;color:var(--ink2);font-variant-numeric:tabular-nums;white-space:nowrap}
.player .iconbtn{width:28px;height:28px}

/* Call history (mrg-crm-call-history.html) */
.callct{display:inline-flex;align-items:center;gap:3px;height:20px;padding:0 7px;border-radius:99px;background:var(--panel);border:1px solid var(--line-2);font-size:11px;font-weight:600;color:var(--muted);flex:none}
.callct svg{width:11px;height:11px}
.crow .l1 b{flex:1}
.rtabs{padding:0 0 10px;border-bottom:1px solid var(--line-2);margin:0 0 4px;position:sticky;top:0;background:#fff;z-index:2}
.rtabs .seg{display:flex;width:100%}
.rtabs .seg>button{flex:1;justify-content:center;height:30px;padding:0 10px;gap:0}
.rtabs .seg span.count{display:inline-flex;align-items:center;justify-content:center;height:18px;min-width:18px;padding:0 6px;margin-left:6px;border-radius:99px;font-size:11px;font-weight:600;line-height:1;background:var(--panel);border:1px solid var(--line-2);color:var(--ink2);box-shadow:none;flex:none}
.calls{display:flex;flex-direction:column;gap:10px;padding:2px 0 8px}
.ccard{border:1px solid var(--line);border-radius:14px;background:#fff;overflow:hidden}
.chead{display:grid;grid-template-columns:auto 1fr auto;grid-template-areas:"num when chev" "chips chips chips";align-items:center;gap:4px 8px;width:100%;padding:10px 12px;border:0;background:none;text-align:left;cursor:pointer;font:inherit;color:inherit;transition:background var(--fast) var(--ease)}
.chead:hover{background:var(--hover)}
.cnum{grid-area:num;font-size:var(--t-xs);color:var(--muted);font-weight:600}
.cwhen{grid-area:when;font-size:var(--t-sm);color:var(--ink);font-weight:600}
.cchips{grid-area:chips;display:flex;gap:5px;flex-wrap:wrap}
.cchev{grid-area:chev;color:var(--muted);display:grid;transition:transform var(--med) var(--ease)}
.chead[aria-expanded="true"] .cchev{transform:rotate(180deg)}
.ccard.open .chead{border-bottom:1px solid var(--line-2)}
.bpill{display:inline-flex;align-items:center;border-radius:var(--r-pill);padding:2px 9px;font-size:var(--t-xs);font-weight:600;background:var(--panel);color:var(--ink2);line-height:1.4}
.cbody{padding:12px}
.cbody .flabel{color:var(--ink2)}
.trmeta{font-size:11px;color:var(--muted);font-weight:500;margin-top:6px}
.chip-muted{background:oklch(0.6 0.015 270 / .15);color:oklch(0.45 0.015 270)}
.chip-teal{background:oklch(0.6 0.11 185 / .15);color:oklch(0.42 0.09 185)}
.chip-green{background:oklch(0.6 0.13 155 / .15);color:oklch(0.42 0.1 155)}
.chip-warm{background:oklch(0.6 0.11 88 / .15);color:oklch(0.42 0.1 88)}
.chip-hot{background:oklch(0.6 0.14 65 / .15);color:oklch(0.47 0.12 60)}
.pseg.three{grid-template-columns:repeat(3,1fr)}
@media (max-width:1239px){
  .rtabs{display:none}
  .lpanel.t-calls .thread{display:none}
  .lpanel.t-calls .details{display:flex}
  .lpanel.t-details .thread{display:none}
  .lpanel.t-chat .details{display:none}
}
@media (min-width:1240px){
  .plseg{display:none}
}

/* Property profile (mrg-crm-property-profile.html) */
.prof h5{display:flex;align-items:baseline;justify-content:space-between;gap:8px}
.prof h5>span:first-child{font-size:var(--t-xs);color:var(--ink2);font-weight:600}
.prof h5 .meta{font-size:11px}
.pf{padding:8px 0;border-top:1px solid var(--line-2)}
.pf:first-of-type{border-top:0;padding-top:2px}
.pl{display:block;font-size:var(--t-xs);font-weight:600;color:var(--ink);margin-bottom:5px}
.pn{font-weight:500;color:var(--muted);font-size:11px}
.pl .pn{margin-left:4px}
.vrow{display:flex;align-items:center;gap:8px;min-height:28px;font-size:var(--t-sm);color:var(--ink)}
.vrow>span:first-child{flex:1;min-width:0}
.vrow .bold{font-weight:600}
.ns{color:var(--muted);font-weight:500}
.pen{width:28px;height:28px;opacity:.6}
.pen:hover{opacity:1;background:var(--hover)}
.pseg3{display:flex;background:var(--panel);border-radius:10px;padding:3px;gap:2px}
.pseg3 button{flex:1;height:28px;border:0;border-radius:8px;background:none;font:500 var(--t-xs)/1 Inter,sans-serif;color:var(--ink2);cursor:pointer;transition:background var(--fast) var(--ease)}
.pseg3 button:hover:not(.on){color:var(--ink)}
.pseg3 button.on{background:#fff;color:var(--ink);font-weight:600;box-shadow:0 0 0 1px var(--line)}
.sub{margin-top:8px}
.input.sm2{height:34px;font-size:var(--t-sm)}
.erow{display:flex;justify-content:flex-end;gap:6px;margin-top:6px}
.erow2{display:flex;gap:6px;flex-wrap:wrap}.erow2 .input{flex:1;min-width:0;height:34px}
.pac{position:relative}
.pacl{position:absolute;left:0;right:0;top:44px;z-index:10;border-radius:12px;padding:4px}
.paci{display:flex;gap:8px;align-items:flex-start;padding:8px;border-radius:8px;cursor:pointer;font-size:var(--t-sm);border:0;background:none;width:100%;text-align:left;color:inherit}
.paci svg{margin-top:3px;color:var(--muted);flex:none}
.paci b{display:block;color:var(--ink);font-weight:600}
.paci.hov,.paci:hover{background:var(--press)}
.pgo{font-size:10px;color:var(--muted);text-align:right;padding:4px 8px 2px}
.okt{display:inline-flex;align-items:center;gap:5px;color:var(--greenink);font-weight:600;font-size:var(--t-xs)}
.regload{display:flex;align-items:center;gap:8px;margin-top:8px;font-size:var(--t-xs);color:var(--ink2);font-weight:500}
.regcard{margin-top:8px;background:var(--panel);border-left:2px solid #18181b;border-radius:8px;padding:12px}
.regcard b.rcity{display:block;font-size:var(--t-sm);color:var(--ink);font-weight:650;margin-bottom:6px}
.regcard ul{list-style:none;margin:0;padding:0;font-size:12px;line-height:1.5;color:var(--ink)}
.regcard li{position:relative;padding-left:14px;margin-bottom:4px}
.regcard li::before{content:"•";position:absolute;left:2px;color:var(--muted)}
.regcard a{color:var(--tealink);font-weight:600}
.regsrc{font-size:11px;color:var(--muted);margin-top:6px}
.regsrc a{color:var(--muted);text-decoration:underline}
.regfoot{display:flex;justify-content:space-between;align-items:center;margin-top:6px;font-size:11px;gap:8px;flex-wrap:wrap}
@media (max-width:768px){.pseg3 button{height:36px}}

/* Lead panel redesign (mrg-crm-lead-panel_1.html) */
.details{padding:0;gap:0;overflow:hidden;display:flex;flex-direction:column;min-height:0}
.details .topbar,.details .rtabs{flex:none}
.details .rtabs{padding:10px 16px;margin:0;border-bottom:1px solid #e8e8e3;position:relative;top:auto;z-index:1}
.psecs{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}
.details .callsec{margin:12px 16px 0}
.details .calls{padding:12px 16px 16px}
.topbar{padding:12px 16px;border-bottom:1px solid #e8e8e3}
.topbar-phone{font-weight:600;font-size:15px}
.topbar-email{color:#9a9590;font-size:13px}
.topbar-btns{display:flex;gap:8px;margin-top:10px}
.topbar-btns .btn{flex:1}
.topbar-hint{font-size:12px;color:#9a9590;margin-top:6px}
.bkt{display:flex;justify-content:flex-end;margin:-2px 0 6px}
.bkt .lnkm{display:inline-flex;align-items:center;gap:4px}
.secnote{font-size:11px;color:var(--muted);font-weight:500;margin-bottom:4px}
.stp{margin-bottom:10px}
.airow{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:12px;margin-bottom:10px}
.airow>span:first-child{flex:1}
.tsave{display:flex;justify-content:flex-end;margin-top:6px}
.dsec-collapsible{border-bottom:1px solid #e8e8e3}
.dsec-head{display:flex;align-items:center;width:100%;padding:0 16px;min-height:44px;background:none;border:none;cursor:pointer;text-align:left;gap:8px}
.dsec-head:hover{background:#f9f9f7}
.dsec-title{font-weight:600;font-size:14px;flex:1;color:var(--ink)}
.dsec-status{font-size:12px;color:#9a9590;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsec-chev{transition:transform 0.15s;flex-shrink:0;color:var(--muted);display:grid}
.dsec-collapsible.open .dsec-chev{transform:rotate(180deg)}
.dsec-body{padding:0 16px 12px}
@media (max-width:600px){
  .topbar-btns{flex-direction:column}
  .dsec-head{min-height:48px}
}
`;

export function mountCrm(root, host) {
'use strict';
/* =========================================================
   Vocabulary from the shared CRM types (passed in by the host)
   ========================================================= */
const V = host.vocab || {};
const STATUS_LABEL = V.STATUS_LABEL || {};
const STATUS_JOURNEY = V.STATUS_JOURNEY || {};
const OFFER_PATH_LABEL = V.OFFER_PATH_LABEL || {};
const LEAD_STATUSES = V.LEAD_STATUSES || Object.keys(STATUS_LABEL);
const OFFER_PATHS = V.OFFER_PATHS || Object.keys(OFFER_PATH_LABEL);
const NEEDS_YOU_LABEL = V.NEEDS_YOU_LABEL || {};
const isBookedThisWeek = V.isBookedThisWeek || (() => false);
const PLAN_OPTIONS = V.PLAN_OPTIONS || [];
const CONTRACT_OPTIONS = V.CONTRACT_OPTIONS || [{ value: '', label: 'Not recorded' }];
const LEAD_SOURCES = V.LEAD_SOURCES || [];
const PROCESS_LABEL = V.PROCESS_LABEL || {};
const PERMIT_LABEL = V.PERMIT_LABEL || {};
const STR_LABEL = V.STR_LABEL || {};
const LOGO = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAAOXElEQVR42u2dechsZR3HP7+Zea95s1y4lQsIZQUVSqiFLWTbtUVpw5IKRFuEJCXUNpJItCjLpCJMrKtiSSlmtlkSec2l/Z8W6Y80sKwgXNrU3ndmfv1xnsf7cJzzLGfOnHnOzHngct935p0z5zzPb/n+djnwwEOGFGtCv9ZpDQFGzgv7AANAa1xMan4u5Rpi/l/096zqss8thtkfcQlgClwHHA6MDSH0q1tLHSaZ9bs95xHwe+A4YDBy/vhg4KB+H9diPWB/cFXApqGQaS8BVnbZs92cRQDiHHxPAKu7Bq5q6A96zdcoAWD0q5vIP5oAZJ4L9av7EkA9psWpxnQYGiDRL7J28IyBE4CPGpt/OK8K+DXw235vO7UOi1HfsQTweENFo14CkLsTaGTMvL1jVYBGfsHEWA19zCBvF7N19U6TbcJ+zc2FnbIAUvwAvRm4ogQ5WIKp10uczCSARlCMZCoqJbcN7bIE6JoK8IGuRTi1dNUDA9LrRtYyMqQreJD9IUfu4aDBVKte73ZQog0yF589Jy+YSWJVgPQcuboYoOscKQmE2RNyaT9iXcG5i2L1EILMwDlaU8TKgrGKtE2cgzk2owsgaJavQBKeq/z5RTrLbBBnQsuewJzFoiS+rxHc5UqLEHerR3WUJYvOmcQxAfYFjqjI6V84BtCMubvqoDTiYELFEpIgknUBXDgEtszh3wQcb75nmJMrWDIU81WEoB59GiNRJKCLJUFvhw5hwxz+04CfAM/HKdpoOxgkmVoeoRKoRRGaJpRgUTMf83/Ai83hH8Ge0q2lxAK0JZ0+bigRRRuwVqquoQsmSpu29TrgRuAQQwyDZbiC25AAA0PdLwHOMUQgc0bmmkDuREQU1QMcU9PBxDn8U4EbKKqypw3o/IWCQG1IHw2ATwMXGSII1SFKA6AnRcJJ4Po6B+IXpy7vbGBXBrWYEmsGNiUdbLLiWcC3gO2GEEY1I34SQRAacAD59LlWmItSkgwayWhbwIXAZ8xeyAIPP8uEkIHDBa8HbjEIeDMB/IRs8qr3UqwCKYl2n/mokYUaClwJvL9BHFRXmklqShgLqEgaA0cBdxhsYIlAEpG6BBB7U+7ZOvtkbfz9DNg72ZF40qWkUFnATY2MGHwK8CMDijZrgEP1EEaVKgipFG3ATz8yh38ocDNFR45x22ZeaM+WHQwaOrbvLuCCCHAoEVwviRFADXgbfUQmHjPvCOBW4LkZHf5jQKAu2bc/cADiR4BrKMqaqjZMAxzq8++nRPOUsFvaZ+O/ynD+oebZcjv8rFLCxAFLbwZ2UxQ3zgKHUuJqqWH7zw2eSgCxfPgnAt8GDghV566bBNBIcPg8IzpfOgMc6gy9rsTF7WPvRwNmolYQ8CZwBnAthZ9/mvHhPyoBcov1W3B4EPBD4BQPOJRIsZ3K7eKRjOqx8c8HPu8UZg4qGjXR1ZQwWmxyMDVcdHkJHA4TgjcxJmVdZ5Oa/bP3dRlwruPgEU+XrqxUAJnnK1pweC3wBMNpowiOjhXvUrP6yGKWJwLfAd5lfh9WXNOW1/8CuK8F3CWpKiDXhE+70ScaVP30GeBQZmCCEIfrHA4ka+MfYu7p+IDVYoHgVcCru1gb2NaaBMDhkcBtwCtK4DAEAjXCL6AVnC8VZt7hFHH8IyNM1iFFEOxk9iSC5FAvIKkZQbrgmxp6ONP1HN4InOaAw4EHD8SKeKnAFbPMvGPZE8eosvGnzjVPBz7ghIOnXesPoAu8KfvaP4CvOvcxDXgOLzVcNXZ0r69DdpX4j0nsdOP4b6HI3dvfY+Nbff8Q8CbgEmAvc/1prmbgsnMDN4zJ924HLU8C4PAcA8AOqACHvpBwLMG7cfyzgG8EbHxLjPcaVXUDsM283vnKoEWHKHcAX6YInPzVAYA+cHgChefwmRFhZfVk+s7CBq6N/wmKRBafjT922rEfC/zMHP5WF0rD2hjWoBGdyIbAj4EXALc7ANAHDg83f/uaQFhZPPq9LCEGTqHGpcCHA6lsVgLtpkj0vMtIivGSnGzSVUfQxOjLe4wI3eUAQB843AF8zwCuzYrnq0rpKksGK122A980gNMXxx+bw77GEOGD5vdJ7hXFuTqCxo6t/U7DfUOnfKoKHCrwRQp3LB5w6JNC9nt3GLD3Ro/zSR0r4GLgJIrs3lHm/RR1mV3CSBhuIIaTPmnQ9D89uGDgpJ2fAXzfAw59+GATeIYx817ocHeVT38IfNAAxJGTAb1STaKW+RATA6SuN7r1Dx5cIM57x1FEFJ8TmXNo92Kn0ePP9jh43K6pp1Akem4wf41gtlaAZqAStgG/A15EEWsP4YKxOcTbKFy1mx4/vfUX7G3Ux8GOKK8y8+4zxHKlubcJ3etoIl2aGGJF8f0UGcWfcg506gGH+wHfBd5n1IFWgEOM4+Y4ChfvXjOkjJUId1Eksu7O2cZv0hGUSwm5BVwj4EMUiaSPeJxGQ8f7drGxKIYV4NBigD87nD1ywKU9/F8aG//OmoefA9aSVAmwjNRxHzhUs/lXAK80h+ZzGllweCpFksmBHs+hVR+nUAxcGDivX0+RpXSvY+N3ufGVDjra9k0dXHC7Qeu3OIenHnD4MopahCMrwKFrfZwPvN3ggS8ZS+SRDph50X0XcusPoDVxwV+M2L6kNA21Chw+1VgIJ1WAQ2t9bABXA0cD73Eqm6Yr0j5OV6Fd/MTR1acDZwaGW9i/3Q58nSLbqAocWiK4MwA4V6JZtGZwUzIHLsCohC8YXPD3gNPIcvkFhssfV2H3T5zJKrqKbeJWpS2riwtuMf6CnwecRpZA3mo+c5gHF6zsvIA2zUBp0Wl0t0HsV0c6jY424PDYhELVrquA7JNC5w0mbRoUf24gmGQJ5MkUhaqneSKKKysBpKPNn6Ui4ueacx+nyCr+twcXDJ0sn0sNltAaEcWVBoGamQqwHL1VcUhuMOk6wsEkN93svcAPgCclRBTpcrPorkkAe78XGV3vOySLC35jwOGNHlzggsOdBhccFRlRlI6125W2k0KlYeKdAMdQpJCFGky4waTXAp+NCCaNKQpRdgNvC0QU2xy8tbS5gTkCxX+Zh90FfM7J4xsGgklnA+/AH0yyTqN9gK9RxAa2MqzxWzgGaCsaqDWridVw55kUadj7elSCG0y6nCLv8E+RTqPzDKHtVaPjh3a5PFwz9gSqo7e3KLpvuplAg4DT6A6DC24KBJOGTkTRdv7YzFgSSI4JIYuWIBtOmvhthhgmnkOyuOBvBhfEBpOOMUS2s1QC1umEkFVxBI2c1mxnRDSUdGv7bDBpGsAFtvvXhR11EyfHAiRDM1ADjafUOH5ICCZtGAfQToqkj2HFAduQ8H8yTghZiazgeSqWpUZNgHUa3UyRZHKrJ/4/yHz/sjQD2x5CrXMkn94DvJyivi8mD0A6OHep9ergruCMiWPq3RvZEFq7jgHWamJmQmXStlWehtp2MKhrG9nlLCDNsU+g0A+Wzs4RJP0waNZ6drD24+D74dFNzNTpxWyfELKSKkBXWaUNVnRodK+qVqw/QK7EJV0nrkFDs/l6Pd9hR1BXwV8PSHsV0EuUtjuFyhpybdNWgPYTQ/q1tgSgvcjuth9AM9xMyYQ4ZB1AoGSYE9h7AtccA2gmKkC7mkK9jC4ebmmVOm3ctGb61rhU6DlxkjxpID0s5vqScP9j53nFeY0G08y1SQJoCgNs83znjkSJZO9pf6fer/xc+zWwkft6rn9ATYmyw3MW29uUXKOWMICl9Lspiil0xkyfh80/SczZ+wpFfx9Xqtif70zkzFn3fBXwqxK32uvfk8gc9jnPo+hLPGuo5E8b6kamOakAe1h/pGitTs3R8LMO6LIInJOS0q2le76iIXe6vd+HgI81cM+dxABD9tTXzyrA3KpZDygVqsrV0xIYFFn1/kagH8CkYkqZr2BlI8As0xqTTOdWASkX1sQbkhKA8s3mDW1i+fVJgkQpj5HTCjWnpRY0sZusFQRV/r5xCxaPLiIcXIUHpMSFvn4CGlF1JBHULJ6/lcBA6Vnzg6uegTlG00uDAHphKkBrFodqBEhUzyFrwth3jbymzODAWfMCQwQqkc+ac7VQtAqQOcVJefKmeICVeD4rM64xS0f7RHrMZ5rYSPVIEx9BaU19Ps9nFuYJnHXwUlOsV4neKnFf5mL16H7ftbWhTl/iwRVSIX18fQukLYkyaCAA4qNuiRT5saogBo+ox4GlCYetka8JcVggpe9Sa1ladawADWy+BMRV1ec1YfJ3KmFIBGeGDkwj+hHEeE1D6ixW/Gub08NDKkAiNyok9mK7kUlJzGvg0HWG5AqBX/EccJUU9KkFTdzH1hpEaM2L6xyiMeY9iaRo8ZhtEnmode5bEvBC7L2lhJ5lmYUhKaKqirPFo7vncZBoosgmAqeoZ+5wU/kD6iHohSWfjBrs0yMB33rIPJIIkzEW4KkHVEqCStJARFQjTFsCOEMjo67akAVTyw9QtTkxNq5EijCdcW0iCCOGMDWhsVQTOlojcUZdM08bAIm1wsExJp1UeOJCphoeMzIUGwhxYyzXp+b8SeT3auR1NQEXSMQ5tN4fwGcChsy/EDpXz0NrQksXqdEeRiNNVR+jSMBVriwhH3GUABZtKLdfea9hoKV9LQzwX/a0Ye9X3svmVDzcpAQ4imKu3qhmpooGAjepCD0meic13chS817q3K8GME/s3pUlwBbwrBhfR+wIlMt7xuq0SqjED6O+Opi1rkQe9c2h6ItD+7W+azQjYrWKQ5L79dgzfgwGGNXosd+vbgLCUZkABHjQ/BvPaCApCe7GVFMvxlXbRHWyzpEBTaIpRoLbu43noDQe54EyCBTgDSVQqBGpXXgCNhoRXdOEBJNUUNokIdX1NcQSfcpBN5E48iiTuxjg/l5Crp86+D9qbdaBTsRvDgAAAABJRU5ErkJggg==";
const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/* ---------------- icons (same line set as the hub) ---------------- */
const I = {
  home:'<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
  users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8"/><path d="M18 14.3c2.1.7 3.5 2.6 3.5 5.7"/>',
  clip:'<rect x="5" y="4" width="14" height="17" rx="2"/><rect x="9" y="2.5" width="6" height="3" rx="1"/><path d="M9 11h6M9 15h4"/>',
  building:'<rect x="4" y="3" width="11" height="18" rx="1"/><path d="M15 9h5v12h-5"/><path d="M8 7h3M8 11h3M8 15h3"/>',
  team:'<circle cx="12" cy="7" r="3"/><circle cx="5" cy="10" r="2.2"/><circle cx="19" cy="10" r="2.2"/><path d="M6.5 20c0-3.3 2.4-5.5 5.5-5.5s5.5 2.2 5.5 5.5"/><path d="M1.5 19c0-2.3 1.4-3.9 3.5-4.2M22.5 19c0-2.3-1.4-3.9-3.5-4.2"/>',
  brief:'<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><path d="M3 12.5h18"/>',
  chart:'<path d="M4 4v16h16"/><path d="M8 16v-4M12 16V8M16 16v-6"/>',
  spark:'<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.7 1.8 1.8.7-1.8.7L19 20l-.7-1.8-1.8-.7 1.8-.7z"/>',
  gear:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  search:'<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  chev:'<path d="m6 9 6 6 6-6"/>',
  back:'<path d="m15 6-6 6 6 6"/>',
  x:'<path d="M6 6l12 12M18 6 6 18"/>',
  check:'<path d="m5 12 5 5 9-10"/>',
  phone:'<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
  mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  refresh:'<path d="M20 11a8 8 0 0 0-14.9-3.6M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.9 3.6M20 20v-4h-4"/>',
  more:'<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  up:'<path d="M12 19V5M6 11l6-6 6 6"/>',
  copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  trash:'<path d="M4 7h16M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  upload:'<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
  file:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
  text:'<path d="M5 6h14M5 10h14M5 14h10M5 18h7"/>',
  bell:'<path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  key:'<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3M15 8l2 2"/>',
  out:'<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 17l-5-5 5-5M5 12h11"/>',
  edit:'<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13 7 4 4"/>',
  pause:'<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',
  play:'<path d="M7 5v14l11-7z"/>',
  alert:'<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5M12 16h0"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  cal:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  inbox:'<path d="M3 13h5l2 3h4l2-3h5"/><path d="M5 5h14l2 8v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6z"/>',
  book:'<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/>',
  sms:'<path d="M4 5h16v11H9l-5 4z"/>',
  rec:'<circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="9"/>',
  arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>',
  eye:'<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  filter:'<path d="M4 6h16M7 12h10M10 18h4"/>',
  dl:'<path d="M12 4v11M7 10l5 5 5-5"/><path d="M4 20h16"/>',
  pin:'<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>'
};
const ic = (n, c = '') => `<svg class="i ${c}" viewBox="0 0 24 24" aria-hidden="true">${I[n] || ''}</svg>`;
const ok = (h, c, L = .6, a) => `oklch(${L} ${c} ${h}${a != null ? ` / ${a}` : ''})`;
const tone = (h, c) => ({ bg: ok(h, c, .6, .15), t: ok(h, c * .9, .45) });
const chip = (txt, h, c) => { const t = tone(h, c); return `<span class="chip" style="background:${t.bg};color:${t.t}">${txt}</span>`; };
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const errMsg = (e, fb = 'That did not work.') => (e && e.message) ? e.message : fb;

/* Display-only: never rewrite stored source / notes values on load alone. */
const SOURCE_EXACT = {
  meta_instant_form: 'Meta Instant Form',
  meta_make: 'Meta Lead Ad',
  meta_paste: 'Meta paste',
  '/book-a-call': 'Book a call',
  'book-a-call': 'Book a call',
  Referral: 'Referral',
  'Meta ad': 'Meta ad',
  'Furniture contest': 'Furniture contest',
  'Airbnb outreach': 'Airbnb outreach',
  Other: 'Other',
};
function sourceAngleLabel(tail) {
  const t = String(tail || '').trim();
  const low = t.toLowerCase();
  if (/makeover|free airbnb makeover/i.test(low)) return 'Free Airbnb Makeover';
  if (/growth\s*fee|growth_fee|growth\s*plan/i.test(low)) return 'Growth Plan Fee';
  if (/self[_\s-]?managed/i.test(low)) return 'Self-Managed';
  if (/badge|superhost|guest favorite/i.test(low)) return 'Badge Status';
  return t.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/\b\w/g, (c) => c.toUpperCase()) || t;
}
function sourceLabel(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (SOURCE_EXACT[s]) return SOURCE_EXACT[s];
  const low = s.toLowerCase();
  if (low === '/book-a-call' || /(^|\/)book-a-call\/?$/.test(low)) return 'Book a call';
  const m = s.match(/^(meta_make|meta_paste|meta_instant_form)\s*[:\s]\s*(.+)$/i);
  if (m) return sourceAngleLabel(m[2]);
  if (/^meta_/i.test(s)) return sourceAngleLabel(s.replace(/^meta_[a-z]+\s*[:\s]*/i, '') || s);
  return s;
}
function clipWords(s, max = 78) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const sp = cut.lastIndexOf(' ');
  const base = (sp > Math.floor(max * 0.45) ? cut.slice(0, sp) : cut).trimEnd();
  return `${base}…`;
}
const NOTE_KEY_LABEL = {
  full_name: 'Full name', phone_number: 'Phone', phone: 'Phone', email: 'Email',
  campaign_name: 'Campaign', campaign_or_ad: 'Campaign', ad_name: 'Ad', form_name: 'Form',
  city: 'City', address: 'Address', has_airbnb: 'Has Airbnb', airbnb: 'Airbnb',
  do_you_have_an_airbnb: 'Has Airbnb', do_you_have_a_live_airbnb: 'Live Airbnb',
  where_are_you_in_the_process: 'Process stage', lead_status: 'Lead status',
  created_time: 'Created', ad_id: 'Ad id', id: 'Id',
};
function noteKeyLabel(key) {
  if (NOTE_KEY_LABEL[key]) return NOTE_KEY_LABEL[key];
  return String(key || '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim().replace(/\b\w/g, (c) => c.toUpperCase()) || key;
}
function formatNotesForDisplay(raw) {
  return String(raw || '').split('\n').map((line) => {
    const t = line.replace(/\s+$/g, '');
    if (!t.trim()) return t;
    if (/^\[AI summary\]/i.test(t)) return `AI summary: ${t.replace(/^\[AI summary\]\s*/i, '')}`;
    if (/^\[Thread facts\]/i.test(t)) return `Thread facts: ${t.replace(/^\[Thread facts\]\s*/i, '')}`;
    const kv = t.match(/^([a-z][a-z0-9_]*)\s*:\s*(.*)$/i);
    if (kv && /_/.test(kv[1])) return `${noteKeyLabel(kv[1])}: ${kv[2]}`;
    if (kv && NOTE_KEY_LABEL[kv[1]]) return `${NOTE_KEY_LABEL[kv[1]]}: ${kv[2]}`;
    return t;
  }).join('\n');
}

/* ---------------- vocab colours ---------------- */
const STAGE_HUE = { new:[255,.14], engaging:[185,.11], nurturing:[300,.12], interested:[65,.14], booked:[275,.15], call_done:[88,.11], won:[155,.13], low_fit:[270,.02], skip:[270,.02] };
const stageChip = (s) => chip(esc(STATUS_LABEL[s] || s || 'New'), ...(STAGE_HUE[s] || [270, .02]));
const REASON_HUE = { draft_review:[65,.14], review_ai:[65,.14], unanswered_inbound:[255,.14], ai_stuck:[25,.18], kb_miss:[300,.12], high_intent:[155,.13], send_contract:[185,.11] };
const pill = (txt, h, c) => { const x = tone(h, c); return `<span class="reason" style="background:${x.bg};color:${x.t}">${txt}</span>`; };
const reasonChip = (r) => pill(esc(NEEDS_YOU_LABEL[r] || r), ...(REASON_HUE[r] || [270, .02]));
const bookedPill = () => pill('Booked this week', 275, .15);
const AIM = { live: ['AI live', 'var(--green)'], paused: ['AI paused', 'var(--amber)'], off: ['AI off', 'oklch(0.75 0.005 285)'] };
const aim = (k) => `<span class="aim"><i class="dot" style="background:${AIM[k][1]}"></i>${AIM[k][0]}</span>`;
const CONTRACT_HUE = { signed:[155,.13], sent:[65,.14], not_sent:[25,.18] };
const contractLabel = (v) => (CONTRACT_OPTIONS.find((o) => o.value === v) || {}).label || '';
const conChip = (v) => v && CONTRACT_HUE[v] ? chip(esc(contractLabel(v) || v), ...CONTRACT_HUE[v]) : '<span class="gapchip">Not recorded</span>';
const AVC = ['255','300','155','355','65','185','275','25','210'];
const hashIdx = (s) => { let h = 0; for (const ch of String(s || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h % AVC.length; };
function initials(name) {
  const p = String(name || '').trim().split(/\s+/).filter(Boolean);
  return ((p[0] ? p[0][0] : '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase() || '?';
}
const av = (l, cls = '') => `<span class="av ${cls}" style="background:oklch(0.5 0.11 ${AVC[hashIdx(l.id)]})" aria-hidden="true">${esc(initials(l.name))}</span>`;
const firstName = (l) => (String(l.name || '').trim().split(/\s+/)[0]) || 'them';
const onboardingLine = (o) => !o ? '' : o.live ? 'Live' : `${o.stage}, step ${o.step} of ${o.total}`;

/* ---------------- phones ---------------- */
const digitsOf = (p) => String(p || '').replace(/\D/g, '');
function telHref(phone) {
  const d = digitsOf(phone);
  if (d.length < 10) return null;
  const e164 = d.length === 10 ? `+1${d}` : d.length === 11 && d.startsWith('1') ? `+${d}` : String(phone).startsWith('+') ? `+${d}` : null;
  return e164 ? `tel:${e164}` : null;
}
/* Company lines (public business line, Twilio sender) are never a client's phone. */
function phoneUsable(phone) {
  const p = String(phone || '').trim();
  if (!p || /^unknown$/i.test(p) || /^n\/?a$/i.test(p)) return false;
  const d = digitsOf(p).replace(/^1(?=\d{10}$)/, '');
  if (d === '6473817325' || d === '2896724026') return false;
  return Boolean(telHref(p));
}
const isTwilioSender = (p) => digitsOf(p).replace(/^1(?=\d{10}$)/, '') === '2896724026';
function fmtPhone(p) {
  const d = digitsOf(p).replace(/^1(?=\d{10}$)/, '');
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : String(p || '');
}

/* ---------------- time ---------------- */
const DAY = 864e5;
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); };
const clock = (d) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
function listTime(iso) {
  const d = new Date(iso || 0);
  if (Number.isNaN(d.getTime()) || !iso) return '';
  const diff = Date.now() - d.getTime();
  if (diff < 60000) return 'Just now';
  const days = Math.round((startOfDay(Date.now()) - startOfDay(d)) / DAY);
  if (days <= 0) return clock(d);
  if (days === 1) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function dayLabel(iso) {
  const d = new Date(iso);
  const days = Math.round((startOfDay(Date.now()) - startOfDay(d)) / DAY);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
const shortDate = (iso) => { const d = new Date(iso || 0); return Number.isNaN(d.getTime()) || !iso ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); };
function ago(iso) {
  const diff = Date.now() - new Date(iso || 0).getTime();
  if (!Number.isFinite(diff) || diff < 0 || !iso) return '';
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.max(1, Math.floor(diff / 60000))}m ago`;
  if (diff < DAY) return `${Math.max(1, Math.floor(diff / 3600000))}h ago`;
  return `${Math.max(1, Math.floor(diff / DAY))}d ago`;
}

/* =========================================================
   State: everything shown comes from the host API
   ========================================================= */
const ssGet = (k) => { try { return sessionStorage.getItem(k) || ''; } catch { return ''; } };
const ssSet = (k, v) => { try { if (v) sessionStorage.setItem(k, v); else sessionStorage.removeItem(k); } catch { /* quota */ } };
const lsGet = (k) => { try { return localStorage.getItem(k) || ''; } catch { return ''; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* quota */ } };

const S = {
  leads: [], loaded: false, loadErr: '', updatedAt: 0, refreshing: false, total: 0,
  settings: null,
  docs: [], docsLoaded: false, docsErr: '',
  tab: 'contacts', leadId: null, ptab: 'chat', rtab: 'details',
  f: { q: '', needs: false, path: 'all', stage: 'all', ai: 'all', booked: false, sort: 'inbox' },
  th: { id: null, messages: [], followups: [], draft: null, loaded: false },
  ld: {},
  sms: '',
  draftEdit: null,
  phoneEdit: null,
  busy: {},
  fupDone: {},
  preCall: {},
  callMsg: '',
  callNotesEdit: false,
  callUi: {},
  transcriptOpen: false,
  transferState: null,
  modal: null,
  menu: null,
  nl: null,
  ed: { id: null, title: '', text: '', busy: false, err: '', loading: false },
  kUp: { title: '', text: '' },
  set: { op: '', opDirty: false, opMsg: '', callerSel: null, nName: '', nPhone: '', nMsg: '', uCode: '', uLabel: '', uMsg: '', paste: '', preview: null, pMsg: '', pErr: '' },
  wm: { id: null, name: '', trigger: '', message: '', nameErr: '', trigErr: '', askDel: null },
  cmd: { q: '', act: 0, items: [] },
  book: { slots: [], dayKey: null, pick: null, loading: false, err: '', leadId: null, step: 'pick', mode: 'book', bookingId: null, googleEventId: null, note: '' },
  prof: { edit: null, q: '', hi: 0, predictions: [], searching: false, placesErr: '', draftName: '', regsLoading: false },
  contractStep: null,
  selectedTemplate: null,
  contractAskCancel: false,
  contractBusy: false,
  sections: {
    book: false,
    profile: false,
    sale: false,
    notes: false,
    ai: false,
  },
};
if (lsGet('crm-sb') === '1') root.classList.add('sb-collapsed');

function normLead(l) {
  return {
    ...l,
    name: l.name || '',
    notes: l.notes ?? '',
    call_notes: l.call_notes ?? '',
    whats_next: l.whats_next ?? '',
    ai_paused: Boolean(l.ai_paused),
    ai_force_on: Boolean(l.ai_force_on),
    ai_send_mode: l.ai_send_mode === 'draft' ? 'draft' : 'autopilot',
    playbook_steps: Array.isArray(l.playbook_steps) ? l.playbook_steps : [],
    offer_path: l.offer_path || 'unknown',
    unread: Boolean(l.unread),
    needs_you: Array.isArray(l.needs_you) ? l.needs_you : [],
    last_sms: l.last_sms ?? null,
    pending_draft: l.pending_draft ?? null,
  };
}
const leadById = (id) => S.leads.find((l) => String(l.id) === String(id));
function mergeLead(id, patch) {
  const i = S.leads.findIndex((l) => String(l.id) === String(id));
  if (i < 0) { if (patch && patch.id) S.leads.unshift(normLead(patch)); return; }
  const next = { ...S.leads[i] };
  for (const [k, v] of Object.entries(patch || {})) if (v !== undefined) next[k] = v;
  S.leads[i] = normLead(next);
}
function aiEffective() { return S.settings ? S.settings.effective_ai_enabled : true; }
function envKill() { return Boolean(S.settings && S.settings.env_kill_switch); }
function aiState(l) {
  const eff = aiEffective() || l.ai_force_on;
  if (!l.ai_paused && eff) return 'live';
  if (l.ai_paused && eff) return 'paused';
  return 'off';
}
const callbackPhone = () => String((S.settings && S.settings.operator_callback_phone) || '').trim();
const activeCallerPhone = () => String((S.settings && S.settings.active_caller_phone) || '').trim();
/** Number that rings first: active_caller_phone, else operator_callback_phone. */
const ringingPhone = () => activeCallerPhone() || callbackPhone();
function samePhone(a, b) {
  const x = digitsOf(a).replace(/^1(?=\d{10}$)/, '');
  const y = digitsOf(b).replace(/^1(?=\d{10}$)/, '');
  return Boolean(x && y && x === y);
}
function teamCallers() {
  const list = (host.data && Array.isArray(host.data.teamCallers)) ? host.data.teamCallers : [];
  return list.filter((c) => c && String(c.phone || '').trim());
}
function D(l) {
  if (!S.ld[l.id]) S.ld[l.id] = { notes: formatNotesForDisplay(l.notes || ''), callNotes: l.call_notes || '', whatsNext: l.whats_next || '', booked: l.booked_by || '', closed: l.closed_by || '', referred: l.referred_by || '' };
  return S.ld[l.id];
}
const isBusy = (k) => Boolean(S.busy[k]);
function setBusy(k, v) { S.busy[k] = v; renderMain(); }

/* =========================================================
   Shell
   ========================================================= */
const NAV_GROUPS = [
  { title: null, items: [{ id: 'dashboard', label: 'Dashboard', icon: 'home' }] },
  { title: 'Operations', items: [{ id: 'onboarding', label: 'Onboarding', icon: 'clip' }, { id: 'properties', label: 'Properties', icon: 'building' }, { id: 'team', label: 'Team', icon: 'team' }, { id: 'sops', label: 'SOPs', icon: 'book' }] },
  { title: 'Business', items: [{ id: 'crm', label: 'CRM', icon: 'users' }, { id: 'clients', label: 'Clients', icon: 'brief' }, { id: 'revenue', label: 'Revenue', icon: 'chart' }] },
  { title: 'Assistant', items: [{ id: 'copilot', label: 'Copilot', icon: 'spark' }] },
];
/* Sidebar Settings always opens OPS /ops/settings. CRM Settings lives in the CRM tablist + Jump to. */
const NAV_FOOT = [{ id: 'settings', label: 'Settings', icon: 'gear' }];
const ALL_NAV = [...NAV_GROUPS.flatMap((g) => g.items), ...NAV_FOOT];
const MOBILE_NAV = ['dashboard', 'crm', 'onboarding', 'team', 'settings'];

root.innerHTML = `<div class="app">
  <aside class="side" aria-label="Main navigation">
    <div class="brand"><img class="logo" src="${LOGO}" alt="" width="34" height="34"><b>Mandel Realty</b><button class="iconbtn sidetog" data-act="sideTog" aria-label="Collapse sidebar" title="Collapse sidebar"><svg class="i sm" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M9 4v16"/><path class="chv" d="m15.5 10-2 2 2 2"/></svg></button></div>
    <button class="jump" data-cmdk>${ic('search', 'sm')}<span class="nl">Jump to…</span><kbd>${isMac ? '⌘K' : 'Ctrl K'}</kbd></button>
    <div id="nav"></div>
    <div class="spacer"></div>
    <div class="foot nav" id="navFoot"></div>
    <div class="me" title="Admin · Shared account"><span class="av sm" style="background:oklch(0.38 0.02 270)">AD</span><div class="nl">Admin<small>Shared account</small></div></div>
  </aside>
  <main class="main">
    <div class="mtop"><div class="brand"><img class="logo" src="${LOGO}" alt="" width="30" height="30"><b>Mandel Realty</b></div><button class="iconbtn" data-cmdk aria-label="Search leads">${ic('search')}</button></div>
    <header class="head">
      <div><div class="date" id="today"></div><h1 id="pageTitle">CRM</h1></div>
      <div class="headacts" id="headActs"><button class="aipill" id="aiPill" data-act="goSettings" title="Auto-reply setting"></button><button class="btn primary addbtn cta-add" data-act="newLead">${ic('plus', 'sm plus')}Lead</button></div>
    </header>
    <div class="subnav"><div class="seg" role="tablist" aria-label="CRM sections" id="tabs"></div></div>
    <div class="content" id="content" data-scroll="content"></div>
  </main>
</div>
<button class="btn primary fab cta-add" data-act="newLead">${ic('plus', 'plus')}Lead</button>
<nav class="bottomnav" id="bnav" aria-label="Sections"></nav>
<div id="ov"></div>
<div id="menuHost"></div>
<div class="toast" id="toast" role="status" aria-live="polite"></div>`;

const $ = (s) => root.querySelector(s);
const shadow = root.getRootNode();

let toastT;
function toast(msg, kind) {
  const t = $('#toast');
  t.className = 'toast' + (kind === 'bad' ? ' bad' : '');
  t.innerHTML = (kind === 'bad' ? ic('alert', 'sm') : ic('check', 'sm')) + `<span>${esc(msg)}</span>`;
  t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), kind === 'bad' ? 4200 : 2400);
}

/* Re-rendering keeps the focused field, its caret and every scroll position. */
function keepFocus(fn) {
  const a = shadow.activeElement;
  const k = a && a.dataset ? a.dataset.k : null;
  let s0 = null, s1 = null;
  if (k) { try { s0 = a.selectionStart; s1 = a.selectionEnd; } catch { /* not a text field */ } }
  const scrolls = {};
  root.querySelectorAll('[data-scroll]').forEach((el) => {
    scrolls[el.dataset.scroll] = { top: el.scrollTop, left: el.scrollLeft };
  });
  fn();
  root.querySelectorAll('[data-scroll]').forEach((el) => {
    const s = scrolls[el.dataset.scroll];
    if (!s) return;
    el.scrollTop = s.top;
    el.scrollLeft = s.left;
  });
  if (k) {
    const el = root.querySelector(`[data-k="${k}"]`);
    if (el && !el.disabled) { el.focus({ preventScroll: true }); try { if (s0 != null) el.setSelectionRange(s0, s1); } catch { /* select */ } }
  }
}

function renderNav() {
  const active = (id) => id === 'crm' ? true : false;
  const item = (n) => `<button data-nav="${n.id}" title="${n.label}" class="${active(n.id) ? 'active' : ''}" ${active(n.id) ? 'aria-current="page"' : ''}>${ic(n.icon)}<span class="nl">${n.label}</span></button>`;
  /* Embedded in the hub shell, or already unmounted: the shell owns the sidebar, so there is nothing to draw. */
  if (!$('#nav') || !$('#navFoot') || !$('#bnav')) return;
  $('#nav').innerHTML = NAV_GROUPS.map((g) => `<div class="navgroup nav">${g.title ? `<h4>${g.title}</h4>` : ''}${g.items.map(item).join('')}</div>`).join('');
  $('#navFoot').innerHTML = NAV_FOOT.map(item).join('');
  $('#bnav').innerHTML = MOBILE_NAV.map((id) => { const n = ALL_NAV.find((x) => x.id === id);
    return `<button data-nav="${id}" class="${active(id) ? 'active' : ''}" ${active(id) ? 'aria-current="page"' : ''}>${ic(n.icon)}${n.label}</button>`; }).join('');
}
function renderHead() {
  $('#today').textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const on = S.settings ? Boolean(S.settings.ai_responses_enabled) && !envKill() : null;
  $('#aiPill').innerHTML = on == null ? '<i class="dot" style="background:var(--grey)"></i>Auto-reply' : `<i class="dot" style="background:${on ? 'var(--green)' : 'var(--amber)'}"></i>${on ? 'Auto-reply on' : 'Auto-reply off'}`;
  const lead = S.leadId ? leadById(S.leadId) : null;
  const title = S.tab === 'settings' ? 'CRM Settings' : S.tab === 'welcome' ? 'Welcome messages' : S.tab === 'knowledge' ? 'Knowledge' : lead ? (lead.name || 'Lead') : 'CRM inbox';
  const pageTitle = $('#pageTitle');
  if (pageTitle) pageTitle.textContent = title;
  document.title = `${title} | Mandel Realty Group`;
  const headActs = $('#headActs');
  if (headActs) headActs.hidden = S.tab === 'settings' || S.tab === 'welcome';
  const tabs = [['contacts', 'inbox', 'Contacts'], ['knowledge', 'book', 'Knowledge'], ['welcome', 'sms', 'Welcome messages'], ['settings', 'gear', 'CRM Settings']];
  $('#tabs').innerHTML = tabs.map(([id, i, l]) => `<button role="tab" data-tab="${id}" aria-selected="${S.tab === id}" class="${S.tab === id ? 'on' : ''}">${ic(i, 'sm')}${l}</button>`).join('');
  root.classList.toggle('lead-open', S.tab === 'contacts' && Boolean(S.leadId));
  root.classList.toggle('no-fab', S.tab !== 'contacts');
}

/* =========================================================
   Contacts: inbox
   ========================================================= */
function filtered() {
  const f = S.f;
  const list = S.leads.filter((l) => {
    if (f.path !== 'all' && l.offer_path !== f.path) return false;
    if (f.stage !== 'all' && l.status !== f.stage) return false;
    const live = aiState(l) === 'live';
    if (f.ai === 'live' && !live) return false;
    if (f.ai === 'paused' && live) return false;
    if (f.booked && !isBookedThisWeek(l)) return false;
    if (f.needs && !(l.needs_you.length > 0)) return false;
    return true;
  });
  const t = (l) => new Date(l.last_activity_at || (l.last_sms && l.last_sms.created_at) || l.created_at).getTime() || 0;
  const c = (l) => new Date(l.created_at).getTime() || 0;
  if (f.sort === 'oldest') return list.sort((a, b) => c(a) - c(b));
  if (f.sort === 'newest') return list.sort((a, b) => c(b) - c(a));
  return list.sort((a, b) => t(b) - t(a));
}
const filterCount = () => { const f = S.f; return (f.path !== 'all') + (f.stage !== 'all') + (f.ai !== 'all') + (f.booked ? 1 : 0) + (f.sort !== 'inbox'); };
const filtersActive = () => filterCount() > 0 || S.f.needs || Boolean(S.f.q.trim());
function subLine(l) {
  const m = l.last_sms;
  if (m && m.body) {
    const body = String(m.body).replace(/\s+/g, ' ').trim();
    if (m.direction === 'outbound') return clipWords((m.meta && m.meta.ai_generated ? 'AI: ' : 'You: ') + body, 78);
    return clipWords(body, 78);
  }
  return clipWords(l.address || STATUS_JOURNEY[l.status] || l.email || 'No messages yet', 78);
}
const reasonsHTML = (l) => { const r = l.needs_you.map(reasonChip); if (isBookedThisWeek(l)) r.push(bookedPill()); return r.join(''); };
const lastIso = (l) => l.last_activity_at || (l.last_sms && l.last_sms.created_at) || l.created_at;
const onbCell = (l) => l.onboarding ? `<button class="lnk" data-act="openUnit" data-id="${esc(l.id)}">${esc(onboardingLine(l.onboarding))} →</button>` : l.status === 'won' ? '<span class="gapchip">Not started</span>' : '<span class="meta">Not sold yet</span>';
const soldish = (l) => l.status === 'won' || l.status === 'call_done';

function tableRow(l) {
  const subx = [l.plan || 'No plan yet', soldish(l) ? (contractLabel(l.contract_status) || 'Contract not recorded') : ''].filter(Boolean).join(' · ');
  return `<tr data-open="${esc(l.id)}" tabindex="0" class="${String(l.id) === String(S.leadId) ? 'sel' : ''}">
   <td class="c-lead"><div class="lead">${av(l)}<div class="t"><span class="nm">${l.unread ? '<i class="unread" title="Unread"></i>' : ''}<span>${esc(l.name || 'Unnamed lead')}</span></span><span class="sub">${esc(subLine(l))}</span><span class="subx">${esc(subx)}</span>${reasonsHTML(l) ? `<div class="reasons">${reasonsHTML(l)}</div>` : ''}</div></div></td>
   <td>${l.source ? esc(sourceLabel(l.source)) : '<span class="meta">Not set</span>'}</td><td>${stageChip(l.status)}</td>
   <td class="c-plan">${l.plan ? esc(l.plan) : '<span class="meta">None yet</span>'}</td>
   <td class="c-contract">${soldish(l) ? conChip(l.contract_status) : '<span class="meta">None yet</span>'}</td>
   <td>${onbCell(l)}</td>
   <td style="text-align:right"><span class="time">${esc(listTime(lastIso(l)))}</span><br>${aim(aiState(l))}</td>
   <td style="width:44px"><button class="iconbtn" data-act="rowMenu" data-id="${esc(l.id)}" aria-label="Actions for ${esc(l.name)}">${ic('more', 'sm')}</button></td></tr>`;
}
function mcard(l) {
  const right = l.onboarding ? `<button class="lnk" data-act="openUnit" data-id="${esc(l.id)}">${esc(String(onboardingLine(l.onboarding)).split(',')[0])} →</button>` : l.status === 'won' ? '<span class="gapchip">Not started</span>' : aim(aiState(l));
  return `<div class="mcard" data-open="${esc(l.id)}" role="button" tabindex="0"><div class="l1">${av(l, 'sm')}${l.unread ? '<i class="unread" title="Unread"></i>' : ''}<b>${esc(l.name || 'Unnamed lead')}</b><span class="time">${esc(listTime(lastIso(l)))}</span></div>
    <span class="sub">${esc(subLine(l))}</span>
    <div class="chips">${stageChip(l.status)}${reasonsHTML(l)}</div>
    <div class="ml"><span>${esc([l.source ? sourceLabel(l.source) : 'No source', l.plan || 'No plan yet'].join(' · '))}${l.status === 'won' ? ' ' + conChip(l.contract_status) : ''}</span><span>${right}</span></div></div>`;
}
function leadCallCount(id) {
  const hd = callHostData();
  const map = hd.leadCallCounts || {};
  const fromMap = Number(map[String(id)]);
  if (Number.isFinite(fromMap) && fromMap > 0) return Math.round(fromMap);
  const fromLead = Number((leadById(id) || {}).call_count);
  return Number.isFinite(fromLead) && fromLead > 0 ? Math.round(fromLead) : 0;
}
function crow(l) {
  const n = leadCallCount(l.id);
  const callBadge = n > 0
    ? `<span class="callct" title="${n} call${n > 1 ? 's' : ''}" aria-label="${n} calls">${ic('phone', 'xs')}${n}</span>`
    : '';
  return `<button class="crow ${String(l.id) === String(S.leadId) ? 'sel' : ''}" data-open="${esc(l.id)}">${av(l, 'sm')}<span class="t">
    <span class="l1">${l.unread ? '<i class="unread" title="Unread"></i>' : ''}<b>${esc(l.name || 'Unnamed lead')}</b>${callBadge}<span class="time">${esc(listTime(lastIso(l)))}</span></span>
    <span class="sub">${esc(subLine(l))}</span>
    <span class="l3">${stageChip(l.status)}${reasonsHTML(l)}${aim(aiState(l))}</span></span></button>`;
}
const opt = (v, label, cur) => `<option value="${esc(v)}" ${String(v) === String(cur) ? 'selected' : ''}>${esc(label)}</option>`;
const needsCount = () => S.leads.filter((l) => l.needs_you.length > 0).length;
function chipSeg() {
  return `<div class="chipseg"><button data-act="needs" data-v="0" class="${S.f.needs ? '' : 'on'}">All</button><button data-act="needs" data-v="1" class="${S.f.needs ? 'on' : ''}">Needs you <span class="count">${needsCount()}</span></button></div>`;
}
function filterBar() {
  const f = S.f, n = filterCount();
  return `<div class="filters" role="search">
    <div class="search">${ic('search', 'sm')}<input class="input" type="search" data-k="f.q" value="${esc(f.q)}" placeholder="Search name, phone, email, address or listing" aria-label="Search leads"></div>
    ${chipSeg()}
    <label class="fsel ${f.path !== 'all' ? 'on' : ''}"><select class="input" data-sel="f.path" aria-label="Path">${opt('all', 'All paths', f.path)}${OFFER_PATHS.map((p) => opt(p, OFFER_PATH_LABEL[p] || p, f.path)).join('')}</select></label>
    <label class="fsel ${f.stage !== 'all' ? 'on' : ''}"><select class="input" data-sel="f.stage" aria-label="Stage">${opt('all', 'All stages', f.stage)}${LEAD_STATUSES.map((s) => opt(s, STATUS_LABEL[s] || s, f.stage)).join('')}</select></label>
    <label class="fsel ${f.ai !== 'all' ? 'on' : ''}"><select class="input" data-sel="f.ai" aria-label="AI">${opt('all', 'AI: all', f.ai)}${opt('live', 'AI: live', f.ai)}${opt('paused', 'AI: paused', f.ai)}</select></label>
    <button class="ftog ${f.booked ? 'on' : ''}" data-act="bookedWeek" role="switch" aria-checked="${f.booked}"><span class="switch ${f.booked ? 'on' : ''}"><i></i></span>Booked this week</button>
    <label class="fsel ${f.sort !== 'inbox' ? 'on' : ''}"><select class="input" data-sel="f.sort" aria-label="Sort">${opt('inbox', 'Sort: Inbox', f.sort)}${opt('newest', 'Sort: Newest', f.sort)}${opt('oldest', 'Sort: Oldest', f.sort)}</select></label>
    <button class="btn sm filtbtn ${n ? 'on' : ''}" data-act="filters">${ic('filter', 'xs')}Filters${n ? ` · ${n}` : ''}</button>
    ${filtersActive() ? '<button class="clear" data-act="clearFilters">Clear filters</button>' : ''}
  </div>`;
}
function updatedLabel() {
  if (!S.updatedAt) return '';
  const s = Math.round((Date.now() - S.updatedAt) / 1000);
  return s < 30 ? 'Updated just now' : s < 3600 ? `Updated ${Math.round(s / 60) || 1}m ago` : 'Updated a while ago';
}
const refreshBtn = () => `<button class="iconbtn bd" data-act="refresh" aria-label="Refresh" title="Refresh">${ic('refresh', 'sm')}</button>`;
function listHead(list) {
  const of = list.length !== S.leads.length || S.f.q.trim();
  return `<div class="listhead"><span><b>${list.length} ${list.length === 1 ? 'lead' : 'leads'}</b>${of ? ` <span class="meta">of ${S.f.q.trim() ? S.total || S.leads.length : S.leads.length}</span>` : ''}</span>
   <span class="lhr">${S.refreshing ? '<span class="refreshing"><i class="spin"></i>Refreshing…</span>' : `<span class="meta">${updatedLabel()}</span>`}${refreshBtn()}</span></div>`;
}
const emptyCard = (icon, title, text, action) => `<div class="card"><div class="empty"><span class="eic">${ic(icon)}</span><b>${title}</b>${text ? `<span>${text}</span>` : ''}${action || ''}</div></div>`;
function inboxBody(list) {
  if (!S.loaded && !S.loadErr) return `<div class="card"><div class="empty"><span class="refreshing"><i class="spin"></i>Loading leads…</span></div></div>`;
  if (S.loadErr && !S.leads.length) return emptyCard('alert', 'Leads did not load', esc(S.loadErr), '<button class="btn sm" data-act="refresh" style="margin-top:6px">Try again</button>');
  if (!list.length) {
    const onlyNeeds = S.f.needs && !filterCount() && !S.f.q.trim();
    if (onlyNeeds) return emptyCard('check', 'All caught up', 'No drafts to review, replies or follow-ups right now.', '<button class="clear" data-act="showAll" style="margin-top:6px">Show all leads</button>');
    if (!S.leads.length && !S.f.q.trim()) return emptyCard('users', 'No leads yet', 'Leads from Meta, the website and + Lead show up here.', '');
    return emptyCard('search', 'No leads match these filters', 'Try fewer filters or a different search.', '<button class="clear" data-act="clearFilters" style="margin-top:6px">Clear filters</button>');
  }
  return `<div class="card listcard" style="overflow:hidden"><div class="tablebox"><table><thead><tr><th>Lead</th><th>Source</th><th>Stage</th><th class="c-plan">Plan</th><th class="c-contract">Contract</th><th>Onboarding</th><th style="text-align:right">Last</th><th><span class="sr">Actions</span></th></tr></thead>
   <tbody>${list.map(tableRow).join('')}</tbody></table></div><div class="mcards">${list.map(mcard).join('')}</div></div>`;
}
function inboxView() {
  const list = filtered();
  const unread = S.leads.filter((l) => l.unread).length;
  const bookedWeek = S.leads.filter((l) => isBookedThisWeek(l)).length;
  return `<div class="card stats" aria-label="CRM summary">
    <div class="stat"><span class="ic">${ic('users', 'sm')}</span><div><b>${S.f.q.trim() ? S.total || S.leads.length : S.leads.length}</b><span class="l">Leads</span></div></div>
    <div class="stat"><span class="ic">${ic('sms', 'sm')}</span><div><b>${unread}</b><span class="l">Unread</span></div></div>
    <div class="stat"><span class="ic">${ic('cal', 'sm')}</span><div><b>${bookedWeek}</b><span class="l">Booked this week</span></div></div></div>
    ${filterBar()}${listHead(list)}${inboxBody(list)}`;
}

/* =========================================================
   Contacts: one lead
   ========================================================= */
function aiBtn(l) {
  const st = aiState(l), dis = isBusy('save') || envKill() ? 'disabled' : '';
  if (st === 'live') return `<button class="btn sm" data-act="aiTakeOver" ${dis}>${ic('pause', 'xs')}Take over</button>`;
  if (st === 'paused') return `<button class="btn sm primary" data-act="aiResume" ${dis}>${ic('play', 'xs')}Resume AI</button>`;
  return `<button class="btn sm primary" data-act="aiEnable" ${dis}>${ic('spark', 'xs')}Enable AI</button>`;
}
function leadHeader(l) {
  const ph = phoneUsable(l.phone) ? fmtPhone(l.phone) : 'No phone';
  return `<div class="lph"><button class="iconbtn back" data-act="closeLead" aria-label="Back to contacts">${ic('back')}</button>${av(l)}<div class="t"><b>${esc(l.name || 'Unnamed lead')}</b><span>${aim(aiState(l))}<span class="meta">${esc(ph)}</span>${stageChip(l.status)}</span></div><button class="iconbtn bd" data-act="leadMenu" aria-label="More actions">${ic('more', 'sm')}</button><button class="iconbtn closex" data-act="closeLead" aria-label="Close lead">${ic('x', 'sm')}</button></div>`;
}
function sectionWrap(key, title, statusText, body, defaultOpen = false) {
  const open = S.sections[key] ?? defaultOpen;
  return `
      <div class="dsec-collapsible ${open ? 'open' : ''}">
        <button type="button"
          class="dsec-head"
          data-act="toggleSection"
          data-key="${esc(key)}"
          aria-expanded="${open}">
          <span class="dsec-title">${title}</span>
          <span class="dsec-status">${statusText}</span>
          <span class="dsec-chev">${ic('chev', 'sm')}</span>
        </button>
        <div class="dsec-body">${open ? body : ''}</div>
      </div>`;
}
function msgBy(m) {
  if (m.direction !== 'outbound') return null;
  const meta = m.meta || {};
  if (meta.ai_generated) return 'Sent by AI';
  if (meta.nurture) return 'Nurture';
  return 'You';
}
function canFollowUp() {
  const msgs = S.th.messages;
  const last = msgs[msgs.length - 1];
  return Boolean(last && last.direction === 'outbound' && !S.th.draft && !S.fupDone[last.id || last.created_at]);
}
function thread(l) {
  const first = esc(firstName(l));
  const phoneOk = phoneUsable(l.phone);
  const msgs = S.th.id === l.id ? S.th.messages : [];
  const draft = S.th.id === l.id ? S.th.draft : null;
  const composer = `<div class="composer"><textarea class="input" rows="1" data-k="sms" aria-label="Message" placeholder="${phoneOk ? `Write to ${first} yourself…` : 'Add a phone number to text'}" ${phoneOk ? '' : 'disabled'}>${esc(S.sms)}</textarea><button class="sendbtn ${S.sms.trim() && phoneOk && !isBusy('sms') ? '' : 'off'}" data-act="sendSms" aria-label="Send">${ic('up', 'sm')}</button></div>`;
  if (S.th.id === l.id && !S.th.loaded && !msgs.length) {
    return `<div class="msgs" data-scroll="msgs"><div class="firsttext"><span class="refreshing"><i class="spin"></i>Loading messages…</span></div></div>${composer}`;
  }
  if (!msgs.length && !draft) {
    const mode = l.ai_send_mode === 'draft' ? 'draft' : 'auto';
    const st = aiState(l);
    const dis = !phoneOk || st !== 'live' || envKill() || isBusy('save');
    return `<div class="msgs" data-scroll="msgs"><div class="firsttext"><span class="empty" style="padding:0"><span class="eic">${ic('sms')}</span><b>No messages yet</b></span>
      <span style="font-size:var(--t-sm)">Nothing has gone out to ${first}. Start with an AI text or write your own below.</span>
      <div class="btns"><button class="btn ${mode === 'draft' ? '' : 'primary'}" data-act="aiFirst" ${dis ? 'disabled' : ''}>${ic('spark', 'sm')}${mode === 'draft' ? 'Draft AI first text' : 'Send AI first text'}</button></div>
      <span class="meta">${mode === 'draft' ? 'You review the draft before it sends.' : 'Autopilot sends it right away.'}</span>
      ${phoneOk && st !== 'live' ? `<span class="meta">${st === 'paused' ? 'Resume AI for this chat first.' : 'Enable AI for this chat first.'}</span>` : ''}
      ${!phoneOk ? `<div class="warnbox">${ic('alert', 'sm')}<span><b>No phone number.</b> Add one in Details before texting.</span></div>` : ''}</div></div>${composer}`;
  }
  let lastDay = '';
  const body = msgs.map((m) => {
    const d = dayLabel(m.created_at);
    const sep = d !== lastDay ? `<span class="daysep">${esc(d)}</span>` : '';
    lastDay = d;
    const mType = m.type || (m.meta && m.meta.type) || '';
    if (mType === 'booking_confirmed') {
      const when = formatBookingWhen(m.booked_at || m.body || m.created_at);
      const eventId = (m.google_event_id || (m.meta && m.meta.google_event_id) || '').trim();
      const bookingId = (m.booking_id || (m.meta && m.meta.booking_id) || '').trim();
      const calHref = eventId
        ? `https://calendar.google.com/calendar/event?eid=${encodeURIComponent(eventId)}`
        : 'https://calendar.google.com/calendar/r';
      return `${sep}<div class="bkdone"><div class="ok">✓ Call booked</div><div class="when">${esc(when)}</div><div class="w2">30-min intro call with Ryan Mandel</div><div class="w3">Added to calendar · Confirmation sent to lead</div><div class="bkacts"><a href="${esc(calHref)}" target="_blank" rel="noopener noreferrer">View in calendar →</a><a href="#" data-act="rescheduleBooking" data-booking-id="${esc(bookingId)}" data-event-id="${esc(eventId)}">Reschedule</a></div></div>`;
    }
    if (mType === 'ai_slot_offer') {
      const t = clock(new Date(m.created_at));
      return `${sep}<div class="bub out">${esc(m.body || '')}</div><div class="bmeta r"><i class="dot" style="background:var(--green);width:6px;height:6px"></i>${esc(`Sent by AI · ${t}`)}</div>`;
    }
    const out = m.direction === 'outbound';
    const by = msgBy(m);
    const t = clock(new Date(m.created_at));
    const metaTxt = out ? `${by} · ${t}` : `${first} · ${t}`;
    return `${sep}<div class="bub ${out ? 'out' : 'in'}">${esc(m.body)}</div><div class="bmeta ${out ? 'r' : 'l'}">${out && m.meta && m.meta.ai_generated ? '<i class="dot" style="background:var(--green);width:6px;height:6px"></i>' : ''}${esc(metaTxt)}</div>`;
  }).join('');
  let draftHTML = '';
  if (draft) {
    const editing = S.draftEdit && S.draftEdit.id === draft.id;
    const steps = l.playbook_steps || [];
    const idx = steps.findIndex((s) => s.status === 'current') + 1;
    const stepBit = idx > 0 ? ` · step ${idx}` : draft.step_title ? ` · ${esc(draft.step_title)}` : '';
    const dis = isBusy('save') ? 'disabled' : '';
    draftHTML = `<div class="draft"><div class="dh">${ic('spark', 'xs')}AI draft · for review${stepBit}<span class="meta">${esc(ago(draft.created_at))}</span></div>
      ${editing ? `<textarea class="input" data-k="draftEdit.text" aria-label="Edit draft">${esc(S.draftEdit.text)}</textarea>` : `<p>${esc(draft.body)}</p>`}
      <div class="da"><button class="btn sm primary" data-act="draftApprove" ${dis}>${ic('check', 'xs')}Approve and send</button>${editing ? `<button class="btn sm" data-act="draftSave" ${dis}>Save</button><button class="btn sm ghost" data-act="draftCancel">Cancel</button>` : `<button class="btn sm" data-act="draftEdit" ${dis}>${ic('edit', 'xs')}Edit</button>`}<button class="btn sm ghost" data-act="draftDiscard" ${dis}>Discard</button></div></div>`;
  }
  const fup = canFollowUp() ? `<div class="fup">${ic('clock', 'sm')}<span>They haven’t replied to the last message.</span><button class="btn sm primary" data-act="followUp" ${isBusy('save') ? 'disabled' : ''}>Follow up</button><button class="btn sm" data-act="fupDone">Done</button></div>` : '';
  return `<div class="msgs" data-scroll="msgs" id="msgs">${body || '<span class="daysep">No messages yet</span>'}</div>${draftHTML}${fup}${composer}`;
}
function aiBlock(l) {
  const st = aiState(l), mode = l.ai_send_mode === 'draft' ? 'draft' : 'autopilot';
  const eff = aiEffective();
  const expl = st === 'live' ? (l.ai_force_on && !eff ? 'AI answers this lead only. Auto-reply is off for everyone else.' : 'AI answers this lead.')
    : st === 'paused' ? 'You took over. AI stays quiet until you resume.' : `AI is off for this chat.${!eff ? ' Auto-reply is off in Settings.' : ''}`;
  const dis = isBusy('save') ? 'disabled' : '';
  const d = D(l);
  return `<div class="airow">${aim(st)}${aiBtn(l)}<span class="meta">${expl}</span></div>
    ${envKill() ? `<div class="warnbox">${ic('alert', 'sm')}<span><b>CRM AI is switched off on the server.</b> The env kill switch overrides every chat.</span></div>` : ''}
    <span class="flabel">How AI sends</span><div class="aiseg" role="radiogroup" aria-label="How AI sends"><button role="radio" aria-checked="${mode === 'autopilot'}" class="${mode === 'autopilot' ? 'on' : ''}" data-act="sendMode" data-v="autopilot" ${dis}>Autopilot</button><button role="radio" aria-checked="${mode === 'draft'}" class="${mode === 'draft' ? 'on' : ''}" data-act="sendMode" data-v="draft" ${dis}>Draft for review</button></div>
    <div class="aiexp">${mode === 'autopilot' ? 'Autopilot sends AI replies immediately, no review.' : 'AI writes a draft. Nothing sends until you approve it.'}</div>
    <label class="flabel" for="tellai" style="margin-top:12px;display:block">Tell the AI</label>
    <textarea class="input" id="tellai" style="min-height:62px" data-k="ld.notes" data-save="notes" placeholder="What the AI should know about this lead before the next text…">${esc(d.notes)}</textarea>
    <div class="tsave"><button class="btn sm" data-act="saveNotes" ${dis}>Save</button></div>
    <div class="hint">The AI uses this on the next SMS. Saves when you click away.</div>`;
}
function bookTzParts(iso) {
  const d = new Date(iso);
  const fmt = (opts) => new Intl.DateTimeFormat('en-US', { timeZone: 'America/Toronto', ...opts }).format(d);
  const weekday = fmt({ weekday: 'short' });
  const month = fmt({ month: 'short' });
  const dayNum = fmt({ day: 'numeric' });
  const y = fmt({ year: 'numeric' });
  const m = String(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Toronto', month: 'numeric' }).format(d)).padStart(2, '0');
  const day = String(dayNum).padStart(2, '0');
  const time = fmt({ hour: 'numeric', minute: '2-digit', hour12: true });
  return {
    key: `${y}-${m}-${day}`,
    weekday,
    month,
    dayNum,
    long: `${weekday}, ${month} ${dayNum}`,
    time,
  };
}

function bookDaysFromSlots(slots) {
  const map = new Map();
  for (const s of slots || []) {
    const p = bookTzParts(s.start);
    if (!map.has(p.key)) map.set(p.key, { key: p.key, weekday: p.weekday, month: p.month, dayNum: p.dayNum, long: p.long, times: [] });
    map.get(p.key).times.push(s);
  }
  return [...map.values()];
}

function activeCrmBooking(l) {
  const hd = callHostData();
  const row = hd.booking;
  if (row && String(row.lead_id || row.leadId) === String(l.id)) return row;
  return null;
}

function bookPickerHtml(l, b, days) {
  const dayKey = (b.dayKey && days.some((d) => d.key === b.dayKey))
    ? b.dayKey
    : ((days[0] && days[0].key) || null);
  const day = days.find((d) => d.key === dayKey) || days[0];
  const pick = day ? (day.times || []).find((s) => s.start === b.pick) : null;
  const endLabel = pick ? bookTzParts(pick.end).time : '';
  const slotLong = pick ? (pick.label || `${day.long} · ${bookTzParts(pick.start).time}`) : '';
  const busy = isBusy('book');
  return `${b.mode === 'reschedule' ? '<div class="bnote">Rescheduling — pick a new time</div>' : (b.note ? `<div class="bnote">${esc(b.note)}</div>` : '')}
    <div class="days" data-scroll="bookDays" role="radiogroup" aria-label="Day">${days.map((d) => {
      const on = d.key === day.key;
      return `<button type="button" class="dpill ${on ? 'on' : ''}" role="radio" aria-checked="${on ? 'true' : 'false'}" data-act="bookDay" data-day-key="${esc(d.key)}"><span>${esc(d.weekday)}</span><b>${esc(d.dayNum)}</b><span class="mo">${esc(d.month)}</span></button>`;
    }).join('')}</div>
    <label class="sr" for="bookTimeSel">Time</label>
    <div class="selwrap"><select id="bookTimeSel" class="input ${pick ? '' : 'ph'}" data-sel="bookTime" aria-label="Time" ${busy ? 'disabled' : ''}>
      <option value="">Select a time</option>
      ${(day ? day.times : []).map((s) => {
        const t = bookTzParts(s.start).time;
        return `<option value="${esc(s.start)}" ${b.pick === s.start ? 'selected' : ''}>${esc(t)}</option>`;
      }).join('')}
    </select></div>
    ${pick ? `<div class="bmeta2">1 hour · ends at ${esc(endLabel)}</div>` : ''}
    <button type="button" class="btn primary bookbtn" data-act="bookShowConfirm" ${(!pick || busy) ? 'disabled' : ''}>${
      pick
        ? `<span class="bl"><span>Book this time</span><span class="bs">${esc(slotLong)} – ${esc(endLabel)}</span></span>${ic('arrow', 'sm')}`
        : `Book this time ${ic('arrow', 'sm')}`
    }</button>
    ${b.mode === 'reschedule' ? `<button type="button" class="lnkm" data-act="bookKeepCurrent" style="margin-top:8px">Keep current time</button>` : ''}`;
}

function slotConfirmLabel(slot) {
  if (slot && slot.label) return String(slot.label);
  if (!slot || !slot.start) return '';
  const p = bookTzParts(slot.start);
  return `${p.long} · ${p.time}`;
}

function bookConfirmHtml(l, pick) {
  const email = (l.email || '').trim() || '—';
  const phone = (l.phone || '').trim() || '—';
  const busy = isBusy('book');
  const label = slotConfirmLabel(pick);
  return `<div class="ccard2"><div class="ccr"><span class="okc">${ic('check', 'sm')}</span><b>Confirm this booking?</b></div>
    <dl class="cdl"><dt>Slot</dt><dd>${esc(label)}</dd><dt>Calendar invite</dt><dd>→ ${esc(email)}</dd><dt>Confirmation text</dt><dd>→ ${esc(phone)}</dd></dl>
    <div class="cbtns"><button class="btn primary" data-act="confirmBookSlot" ${busy ? 'disabled' : ''}>${busy ? '<i class="spin" style="width:12px;height:12px;border-color:rgb(255 255 255 / .3);border-top-color:#fff"></i>Booking…' : 'Confirm'}</button><button class="btn ghost" data-act="cancelBookConfirm" style="color:var(--muted)" ${busy ? 'disabled' : ''}>Cancel</button></div></div>`;
}

function bookBookedHtml(l, b, booking) {
  const startIso = (booking && (booking.slot_start || booking.slotStart)) || l.call_start_iso || '';
  const when = (booking && (booking.label || booking.call_booking))
    || l.call_booking
    || (startIso ? slotConfirmLabel({ start: startIso }) : '');
  const eventId = String((booking && (booking.google_event_id || booking.googleEventId)) || b.googleEventId || '').trim();
  const bookingId = String((booking && (booking.id || booking.bookingId)) || b.bookingId || '').trim();
  const calHref = eventId
    ? `https://calendar.google.com/calendar/event?eid=${encodeURIComponent(eventId)}`
    : 'https://calendar.google.com/calendar/r';
  if (b.step === 'askcancel') {
    return `<div class="bkdone2"><div class="ok">✓ Call booked</div><div class="when">${esc(when)}</div><div class="w2">30-min intro call with Ryan Mandel</div><div class="w3">Added to calendar · Confirmation sent to lead</div></div>
      <div class="askc" role="alert"><b>Cancel this booking?</b><span>The calendar event will be removed and ${esc(l.name || 'the lead')} will be notified by text.</span><div class="cbtns"><button class="btn sm redtxt" data-act="bookDoCancel" data-booking-id="${esc(bookingId)}" ${isBusy('book') ? 'disabled' : ''}>Yes, cancel</button><button class="btn sm" data-act="bookKeepCurrent" ${isBusy('book') ? 'disabled' : ''}>Keep it</button></div></div>`;
  }
  return `<div class="bkdone2"><div class="ok">✓ Call booked</div><div class="when">${esc(when)}</div><div class="w2">30-min intro call with Ryan Mandel</div><div class="w3">Added to calendar · Confirmation sent to lead</div>
    ${b.note ? `<div class="w3 nt">${esc(b.note)}</div>` : ''}</div>
    <div class="blinks"><a href="${esc(calHref)}" target="_blank" rel="noopener noreferrer" class="lnk">View in calendar →</a><span class="sp"></span><button type="button" class="lnkm" data-act="rescheduleBooking" data-booking-id="${esc(bookingId)}" data-event-id="${esc(eventId)}">Reschedule</button><span class="dotsep">·</span><button type="button" class="lnkm" data-act="bookAskCancel">Cancel booking</button></div>`;
}

function bookBlock(l) {
  const b = S.book;
  const booking = activeCrmBooking(l);
  const leadBooked = Boolean(booking) || l.status === 'booked' || Boolean(l.call_start_iso);
  const rescheduling = b.mode === 'reschedule' && b.leadId === String(l.id);
  const dis = isBusy('book') || b.loading ? 'disabled' : '';
  const showBooked = leadBooked && !rescheduling && b.step !== 'pick' && b.step !== 'confirm';

  let body;
  if (b.step === 'askcancel' || showBooked) {
    body = bookBookedHtml(l, b, booking);
  } else if (b.step === 'confirm') {
    const pick = (b.slots || []).find((s) => s.start === b.pick);
    body = pick ? bookConfirmHtml(l, pick) : '<div class="meta">Pick a time first.</div>';
  } else if (b.loading && b.leadId === String(l.id)) {
    body = `${b.note ? `<div class="bnote">${esc(b.note)}</div>` : ''}<div class="meta"><span class="refreshing"><i class="spin"></i>Loading open times…</span></div>`;
  } else if (b.err && b.leadId === String(l.id)) {
    body = `${b.note ? `<div class="bnote">${esc(b.note)}</div>` : ''}<div class="warnbox">${ic('alert', 'sm')}<span>${esc(b.err)}</span></div>
      <button class="btn sm" style="margin-top:8px" data-act="reloadBookSlots" ${dis}>${ic('refresh', 'xs')}Retry</button>`;
  } else {
    const days = bookDaysFromSlots(b.slots || []);
    if (!days.length) {
      body = `${b.note ? `<div class="bnote">${esc(b.note)}</div>` : ''}<div class="meta" style="margin-top:4px">No open times in the next week. Connect Google in Settings → Connectors, or try again later.</div>
        <button class="btn sm" style="margin-top:8px" data-act="reloadBookSlots" ${dis}>${ic('refresh', 'xs')}Refresh</button>`;
    } else {
      body = bookPickerHtml(l, { ...b, dayKey: b.dayKey || days[0].key }, days);
    }
  }

  return `<div class="bkt"><button type="button" class="lnkm" data-act="reloadBookSlots" ${dis}>${ic('refresh', 'xs')} Reload slots</button></div><div class="bbody booksec">${body}</div>`;
}
function templateBlurb(label) {
  const s = String(label || '').toLowerCase();
  if (/growth/.test(s)) return 'Performance-based · 12-month term';
  if (/essential/.test(s)) return 'Flat monthly fee · Limited scope';
  if (/full\s*service|full service/.test(s) || /\bfull\b/.test(s)) return '25% + HST · Premium service';
  if (/standard|management/.test(s)) return '20% + HST · Full management';
  return 'Host portal · Sign online';
}
function contractDateLabel(iso) {
  if (!iso) return shortDate(new Date().toISOString());
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return shortDate(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function saleContractBody(l) {
  const hd = callHostData();
  const email = String(l.email || '').trim() || 'this lead';
  const phone = phoneUsable(l.phone) ? fmtPhone(l.phone) : (l.phone || '—');
  const name = String(l.full_name || l.name || 'Host').trim();
  const active = hd.activeContract || null;
  const title = active && active.title ? active.title : 'Management agreement';
  const sentAt = active && (active.created_at || active.signed_at || active.signed_on);
  const signedAt = active && (active.signed_on || active.signed_at || active.created_at);
  const contractsUrl = hd.contractsUrl || '';
  const downloadUrl = hd.contractDownloadUrl || '';
  const templates = Array.isArray(hd.templates) ? hd.templates : [];
  const busy = S.contractBusy || isBusy('contract');
  const dis = busy ? 'disabled' : '';
  const cs = String(l.contract_status || '');

  if (S.contractStep === 'picker') {
    const rows = templates.length
      ? templates.map((t) => `<button type="button" class="tplrow" data-act="pickContractTemplate" data-id="${esc(t.id)}" ${dis}><span class="t"><b>${esc(t.label || t.filename || 'Agreement')}</b><span>${esc(templateBlurb(t.label))}</span></span><span class="sel">Select →</span></button>`).join('')
      : `<div class="meta" style="margin-bottom:8px">No templates yet. Upload one in OPS → Settings → Contract templates.</div>`;
    return `<div class="icard"><div class="ih">Choose a contract template</div>${rows}<button type="button" class="lnkm" data-act="cancelContractPick" ${dis}>Cancel</button></div>`;
  }

  if (S.contractStep === 'review' && S.selectedTemplate) {
    const t = S.selectedTemplate;
    return `<div class="icard"><div class="ih">Send contract to ${esc(name)}?</div><dl class="rdl"><dt>Template</dt><dd>${esc(t.label || t.filename || 'Agreement')}</dd><dt>To</dt><dd>${esc(email)}</dd><dt>Phone</dt><dd>${esc(phone)}</dd></dl>
      <div class="hint" style="margin:8px 0 10px">${esc(name)} will receive an email with a link to review and sign the contract online.</div>
      <div class="cbtns"><button type="button" class="btn primary" data-act="confirmSendContract" ${dis}>${busy ? '<i class="spin" style="width:12px;height:12px;border-color:rgb(255 255 255 / .3);border-top-color:#fff"></i>Sending…' : 'Send contract'}</button><button type="button" class="btn ghost" data-act="backContractPick" ${dis}>Back</button></div></div>`;
  }

  if (cs === 'signed') {
    const createBtn = l.onboarding
      ? `<div class="okbox" style="margin-top:12px"><span class="okc">${ic('check', 'xs')}</span><span><b>Onboarding unit created</b>${l.onboarding.address ? ' · ' + esc(l.onboarding.address) : ''} · <button type="button" class="lnk" data-act="openUnit" data-id="${esc(l.id)}">Open unit →</button></span></div>`
      : `<button type="button" class="btn primary wide big" data-act="startOnboarding" ${dis}>${ic('arrow', 'sm')}Create onboarding unit</button><div class="hint">Uses the property profile: address, ownership, furnishing and permit status.</div>`;
    return `<div class="ccardk"><div class="kt ok">✓ Contract signed</div><div class="kn">${esc(title)}</div><div class="km">Signed by ${esc(name)} · ${esc(contractDateLabel(signedAt))}</div></div>
      <div class="klinks">${downloadUrl ? `<a href="${esc(downloadUrl)}" target="_blank" rel="noopener" class="lnk">Download PDF →</a>` : '<span class="meta">Download PDF →</span>'}<span class="dotsep">·</span>${contractsUrl ? `<a href="${esc(contractsUrl)}" target="_blank" rel="noopener" class="lnk">View</a>` : '<span class="meta">View</span>'}</div>
      ${createBtn}`;
  }

  if (cs === 'sent') {
    const cancelUi = S.contractAskCancel
      ? `<div class="askc"><b>Cancel this contract?</b><span>The signing link stops working. ${esc(name)} isn’t notified automatically.</span><div class="cbtns"><button type="button" class="btn sm redtxt" data-act="doCancelContract" ${dis}>Yes, cancel</button><button type="button" class="btn sm" data-act="keepContract" ${dis}>Keep it</button></div></div>`
      : `<div class="klinks">${contractsUrl ? `<a href="${esc(contractsUrl)}" target="_blank" rel="noopener" class="lnk">View contract →</a>` : '<span class="meta">View contract →</span>'}<span class="dotsep">·</span><button type="button" class="lnkm" data-act="askCancelContract" ${dis}>Cancel</button></div>`;
    return `<div class="ccardk"><div class="kt">📄 Contract sent</div><div class="kn">${esc(title)}</div><div class="km">Sent to ${esc(email)} · ${esc(contractDateLabel(sentAt))}</div><div class="kaw"><i class="cdot amber"></i>Awaiting signature</div></div>${cancelUi}`;
  }

  const cancelledNote = cs === 'cancelled' ? '<div class="cnote2">Contract cancelled · you can send a new one</div>' : '';
  return `${cancelledNote}<button type="button" class="btn primary wide" data-act="openContractPick" ${dis}>Send contract →</button><div class="hint">Pick a template and send to ${esc(email)}</div>`;
}
function saleSectionBody(l, hl) {
  const d = D(l), dis = isBusy('save') ? 'disabled' : '';
  const gaps = [l.plan, l.contract_status, l.booked_by, l.closed_by].filter((x) => !x).length;
  const showGaps = gaps && soldish(l);
  const status = l.onboarding ? `<button class="lnk" data-act="openUnit" data-id="${esc(l.id)}">${esc(onboardingLine(l.onboarding))}${l.onboarding.address ? ' · ' + esc(l.onboarding.address) : ''} →</button>` : l.status === 'won' ? '<span class="gapchip">Not started</span>' : '<span class="meta">Starts once the lead is Won</span>';
  const act = l.onboarding ? `<button class="btn" style="width:100%;margin-top:10px" data-act="openUnit" data-id="${esc(l.id)}">Open unit ${ic('arrow', 'sm')}</button>`
    : l.status === 'won' && l.contract_status !== 'signed' ? `<button class="btn primary" style="width:100%;margin-top:10px" data-act="startOnboarding">${ic('plus', 'sm')}Start onboarding</button>` : '';
  return `<div class="ks ${hl ? 'hl' : ''}">
    <div class="two stp">
      <div class="field"><label for="stSel">Stage</label><select id="stSel" class="input" data-sel="status" ${dis}>${LEAD_STATUSES.map((s) => opt(s, STATUS_LABEL[s] || s, l.status)).join('')}</select></div>
      <div class="field"><label for="pathSel">Path</label><select id="pathSel" class="input" data-sel="offerPath" ${dis}>${OFFER_PATHS.map((p) => opt(p, OFFER_PATH_LABEL[p] || p, l.offer_path)).join('')}</select></div>
    </div>
    <div class="two">
      <div class="field"><label for="slPlan">Plan</label><select id="slPlan" class="input ${!l.plan ? 'warn' : ''}" data-sel="plan" ${dis}>${opt('', 'Not recorded', l.plan || '')}${PLAN_OPTIONS.map((p) => opt(p, p, l.plan || '')).join('')}</select></div>
      <div class="field"><label for="slCon">Contract</label><select id="slCon" class="input ${!l.contract_status ? 'warn' : ''}" data-sel="contractStatus" ${dis}>${CONTRACT_OPTIONS.map((c) => opt(c.value, c.label, l.contract_status || '')).join('')}</select></div>
      <div class="field"><label for="slBk">Booked by</label><input id="slBk" class="input ${!d.booked ? 'ph' : ''}" data-k="ld.booked" data-save="bookedBy" value="${esc(d.booked)}" placeholder="Not recorded"></div>
      <div class="field"><label for="slCl">Closed by</label><input id="slCl" class="input ${!d.closed ? 'ph' : ''}" data-k="ld.closed" data-save="closedBy" value="${esc(d.closed)}" placeholder="Not recorded"></div>
      ${l.source === 'Referral' ? `<div class="field full"><label>Referred by</label><span class="input" style="display:flex;align-items:center">${d.referred ? esc(d.referred) : '<span class="gap">Not recorded</span>'}</span></div>` : ''}
    </div>
    <div class="kbody">${saleContractBody(l)}</div>
    <dl class="kv" style="margin-top:10px"><dt>Onboarding</dt><dd>${status}</dd></dl>${act}
    ${showGaps ? `<div class="warnbox">${ic('alert', 'sm')}<span><b>Missing sale details.</b> Fill these before the lead is Won. Onboarding flags any that are still empty.</span></div>` : ''}</div>`;
}
function leadTopBar(l) {
  const phoneOk = phoneUsable(l.phone);
  const op = ringingPhone();
  let phone;
  if (S.phoneEdit != null) {
    phone = `<div class="phedit"><input class="input focus" type="tel" inputmode="tel" data-k="phoneEdit" value="${esc(S.phoneEdit)}" placeholder="Phone number" aria-label="Phone number"><button class="btn sm primary" data-act="savePhone" ${isBusy('save') ? 'disabled' : ''}>Save</button><button class="btn sm ghost" data-act="cancelPhone">Cancel</button></div>`;
  } else if (phoneOk) {
    phone = `<span class="phv"><span class="topbar-phone">${esc(fmtPhone(l.phone))}</span><button class="iconbtn" data-act="copyPhone" data-id="${esc(l.id)}" title="Copy phone" aria-label="Copy phone">${ic('copy', 'xs')}</button><button class="iconbtn" data-act="editPhone" title="Edit" aria-label="Edit phone">${ic('edit', 'xs')}</button></span>`;
  } else {
    phone = `<span class="meta">No phone number</span> <button class="btn sm" data-act="editPhone">Add</button>`;
  }
  const canCall = phoneOk && Boolean(op) && !isBusy('call');
  const preDone = Boolean(S.preCall[l.id]) || S.th.messages.some((m) => m.direction === 'outbound' && ((m.meta && m.meta.pre_call === true) || /calling you in a minute from this number/i.test(m.body || '')));
  const callBtns = phoneOk
    ? `<div class="topbar-btns">
        <button class="btn ${canCall ? 'primary' : ''}" data-act="crmCall" ${canCall ? '' : 'disabled'}>${ic('phone', 'sm')}${isBusy('call') ? 'Starting…' : preDone ? 'CRM Call again' : 'CRM Call'}</button>
        <button class="btn ghost" data-act="dialCall">${ic('phone', 'sm')}Dial from phone</button>
      </div>
      <div class="topbar-hint">${preDone ? 'Rings the selected phone first, then connects the lead. No new text.' : 'Calls are recorded · AI texts lead first'}</div>`
    : '<div class="topbar-hint">No phone number</div>';
  return `<div class="topbar">
    <div>${phone}</div>
    <div class="topbar-email">${l.email ? esc(l.email) : 'No email'}</div>
    ${callBtns}
    ${S.callMsg ? `<div class="okbox">${ic('phone', 'sm')}<span>${esc(S.callMsg)}</span></div>` : ''}
    ${phoneOk && !op ? `<div class="warnbox">${ic('alert', 'sm')}<span><b>Choose whose phone rings first in Settings.</b> CRM call rings that phone before the lead. <button class="lnk" data-act="goSettings">Open Settings →</button></span></div>` : ''}
    ${isTwilioSender(op) ? `<div class="warnbox">${ic('alert', 'sm')}<span><b>Caller is set to the Twilio SMS number.</b> Use the business line or a cell instead.</span></div>` : ''}
  </div>`;
}

const OWNERSHIP_OPTS = [
  { v: 'owns', lab: 'Owns' },
  { v: 'renting', lab: 'Renting' },
];
const AIRBNB_OPTS = [
  { v: 'live', lab: 'Live' },
  { v: 'not', lab: 'Not live' },
];
const FURNISHED_OPTS = [
  { v: 'yes', lab: 'Yes' },
  { v: 'partially', lab: 'Partially' },
  { v: 'no', lab: 'No' },
];
const OCCUPANT_OPTS = [
  { v: 'vacant', lab: 'Vacant' },
  { v: 'tenants', lab: 'Tenants' },
  { v: 'family', lab: 'Family' },
];
const PERMIT_PROFILE = ['No permit', 'Applied', 'Approved', 'Not required', 'Unknown'];
const notset = '<span class="ns">Not set</span>';
function fmtCheckedAt(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Toronto' });
}
function strRulesFor(l) {
  const hd = callHostData();
  const cached = hd.strRules;
  if (!cached || typeof cached !== 'object') return null;
  if (cached.leadId && String(cached.leadId) !== String(l.id)) return null;
  return cached;
}
function pseg3(opts, cur, act) {
  return `<div class="pseg3" role="radiogroup">${opts.map((o) => `<button type="button" class="${cur === o.v ? 'on' : ''}" role="radio" aria-checked="${cur === o.v}" data-act="${act}" data-v="${esc(o.v)}">${esc(o.lab)}</button>`).join('')}</div>`;
}
function profileBlock(l) {
  const p = S.prof;
  const addr = String(l.property_address || '').trim();
  const city = String(l.property_city || '').trim();
  const fullName = String(l.full_name || '').trim();
  const ownership = String(l.ownership || '');
  const live = l.airbnb_live === true ? 'live' : l.airbnb_live === false ? 'not' : '';
  const permit = String(l.permit_status || '');
  const furn = String(l.furnished || '');
  const occ = String(l.occupants || '');
  const occNote = String(l.occupant_notes || '');
  const checkedAt = l.str_rules_checked_at || null;
  const rules = strRulesFor(l);
  const dis = isBusy('profile') ? 'disabled' : '';

  let addrRow;
  if (p.edit === 'addr') {
    const preds = Array.isArray(p.predictions) ? p.predictions : [];
    const list = p.q.trim().length >= 3
      ? `<div class="pacl frost" role="listbox">${p.placesErr
        ? `<div class="paci meta" style="color:var(--redink);white-space:normal">${esc(p.placesErr)}</div>`
        : preds.length
        ? preds.map((x, i) => {
          const desc = String(x.description || '');
          const main = desc.split(',')[0] || desc;
          const rest = desc.split(',').slice(1).join(',').trim();
          return `<button type="button" class="paci ${i === p.hi ? 'hov' : ''}" role="option" data-act="profPickPlace" data-place-id="${esc(x.place_id || '')}" data-desc="${esc(desc)}">${ic('pin', 'xs')}<span><b>${esc(main)}</b>${rest ? `<span class="meta">${esc(rest)}</span>` : ''}</span></button>`;
        }).join('')
        : (p.searching ? '<div class="paci meta">Searching…</div>' : '<div class="paci meta">No matches</div>')}<div class="pgo">powered by Google</div></div>`
      : '';
    addrRow = `<div class="pac"><div class="search" style="max-width:none">${ic('search', 'sm')}<input class="input focus" data-k="prof.q" value="${esc(p.q)}" placeholder="Search an address" autocomplete="off" aria-autocomplete="list" aria-label="Property address"></div>${list}<div class="erow"><button type="button" class="btn sm" data-act="profCancel">Cancel</button></div></div>`;
  } else {
    addrRow = `<div class="vrow"><span class="${addr ? 'bold' : ''}">${addr ? esc(addr) : notset}</span><button type="button" class="iconbtn pen" data-act="profEdit" data-v="addr" aria-label="Edit property address">${ic('edit', 'xs')}</button></div>`;
  }

  let nameRow;
  if (p.edit === 'name') {
    nameRow = `<div class="erow2"><input class="input focus" data-k="prof.draftName" value="${esc(p.draftName)}" placeholder="First and last name" aria-label="Full name"><button type="button" class="btn sm" data-act="profCancel">Cancel</button><button type="button" class="btn sm primary" data-act="profSaveName" ${dis}>Save</button></div>`;
  } else {
    nameRow = `<div class="vrow"><span>${fullName ? esc(fullName) : notset}</span><button type="button" class="iconbtn pen" data-act="profEdit" data-v="name" aria-label="Edit full name">${ic('edit', 'xs')}</button></div>`;
  }

  const permitRow = live === 'not'
    ? `<div class="sub"><label class="pl" for="pm-prof">Permit status</label><select class="input sm2 ${permit ? '' : 'ph'}" id="pm-prof" data-sel="profPermit" ${dis}><option value="">Select</option>${PERMIT_PROFILE.map((o) => `<option value="${esc(o)}" ${o === permit ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></div>`
    : '';

  const occNotes = (occ === 'tenants' || occ === 'family')
    ? `<div class="sub"><input class="input sm2" data-k="prof.occNote" data-save-prof="occupant_notes" value="${esc(occNote)}" placeholder="Names or notes" aria-label="Occupant names or notes" ${dis}></div>`
    : '';

  let regsBody = '';
  if (p.regsLoading) {
    regsBody = `<div class="regload"><i class="spin"></i>Checking rules for ${esc(city || 'this city')}…</div>`;
  } else if (rules && rules.notFound) {
    regsBody = `<div class="pn" style="margin-top:8px">No rules on file for ${esc(rules.city || city)}. Check the municipality website directly.</div>
      <div class="regfoot"><span class="meta">${checkedAt ? `Last checked: ${esc(fmtCheckedAt(checkedAt))}` : ''}</span><button type="button" class="lnkm" data-act="profCheckRegs">Re-check</button></div>`;
  } else if (rules && Array.isArray(rules.rules)) {
    regsBody = `<div class="regcard"><b class="rcity">${esc(rules.city || city)}</b><ul>${rules.rules.map((r) => `<li>${esc(typeof r === 'string' ? r : r.text || '')}${r && r.url ? ` <a href="${esc(r.url)}" target="_blank" rel="noopener">link</a>` : ''}</li>`).join('')}</ul>
      <div class="regsrc">Source: <a href="${esc(rules.sourceUrl || '#')}" target="_blank" rel="noopener">${esc(rules.source || '')}</a></div></div>
      <div class="regfoot"><span class="meta">Last checked: ${esc(fmtCheckedAt(rules.checkedAt || checkedAt) || 'today')}</span><button type="button" class="lnkm" data-act="profCheckRegs">Re-check</button></div>`;
  } else if (checkedAt) {
    regsBody = `<div class="regfoot" style="margin-top:8px"><span class="meta">Last checked: ${esc(fmtCheckedAt(checkedAt))}${city ? ` · ${esc(city)}` : ''}</span><button type="button" class="lnkm" data-act="profCheckRegs">Re-check</button></div>`;
  }

  const regsHead = checkedAt || (rules && !rules.notFound)
    ? `<div class="vrow"><span class="okt">${ic('check', 'xs')}Checked${city ? ` for ${esc(city)}` : ''}</span></div>`
    : `<div class="vrow"><span class="ns">Not checked</span>${addr ? `<button type="button" class="btn sm primary" data-act="profCheckRegs" ${dis}>Check regulations →</button>` : ''}</div>${!addr ? '<div class="pn" style="margin-top:4px">Add a property address first.</div>' : ''}`;

  return `<div class="prof"><div class="secnote">Fill in during the sales call</div>
    <div class="pf"><div class="pl">Property address</div>${addrRow}</div>
    <div class="pf"><div class="pl">Full name <span class="pn">If different from lead name</span></div>${nameRow}</div>
    <div class="pf"><div class="pl">Owns or renting</div>${pseg3(OWNERSHIP_OPTS, ownership, 'profOwnership')}</div>
    <div class="pf"><div class="pl">Airbnb listing</div>${pseg3(AIRBNB_OPTS, live, 'profAirbnb')}${permitRow}</div>
    <div class="pf"><div class="pl">Furnished</div>${pseg3(FURNISHED_OPTS, furn, 'profFurnished')}</div>
    <div class="pf"><div class="pl">Occupants</div>${pseg3(OCCUPANT_OPTS, occ, 'profOccupants')}${occNotes}</div>
    <div class="pf"><div class="pl">STR regulations</div>${regsHead}${regsBody}</div></div>`;
}
function callHostData() {
  if (!host.data) {
    host.data = {
      callTranscript: null,
      callRecordingUrl: null,
      callRecordingId: null,
      bookerCallSeconds: null,
      calls: [],
      leadCallCounts: {},
      teamCallers: [],
      activeCall: null,
      booking: null,
      strRules: null,
      templates: [],
      activeContract: null,
      contractsUrl: null,
      contractDownloadUrl: null,
    };
  }
  if (!Array.isArray(host.data.teamCallers)) host.data.teamCallers = [];
  if (!Array.isArray(host.data.calls)) host.data.calls = [];
  if (!Array.isArray(host.data.templates)) host.data.templates = [];
  if (!host.data.leadCallCounts || typeof host.data.leadCallCounts !== 'object') host.data.leadCallCounts = {};
  if (host.data.booking === undefined) host.data.booking = null;
  if (host.data.strRules === undefined) host.data.strRules = null;
  if (host.data.activeContract === undefined) host.data.activeContract = null;
  if (host.data.contractsUrl === undefined) host.data.contractsUrl = null;
  if (host.data.contractDownloadUrl === undefined) host.data.contractDownloadUrl = null;
  return host.data;
}
async function saveProfile(fields, okMsg = 'Saved to lead') {
  const id = S.leadId;
  if (!id || !host.updateProfile) return null;
  try {
    setBusy('profile', true);
    await host.updateProfile(id, fields);
    mergeLead(id, fields);
    if (okMsg) toast(okMsg);
    return true;
  } catch (e) {
    toast(errMsg(e, 'Could not save profile'), 'bad');
    return null;
  } finally {
    setBusy('profile', false);
  }
}
let placesT = 0;
async function searchPlaces(q) {
  S.prof.q = q;
  S.prof.hi = 0;
  S.prof.placesErr = '';
  if (q.trim().length < 3 || !host.placesAutocomplete) {
    S.prof.predictions = [];
    S.prof.searching = false;
    renderMain();
    const inp = root.querySelector('[data-k="prof.q"]');
    if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
    return;
  }
  S.prof.searching = true;
  renderMain();
  const inp0 = root.querySelector('[data-k="prof.q"]');
  if (inp0) { inp0.focus(); inp0.setSelectionRange(inp0.value.length, inp0.value.length); }
  clearTimeout(placesT);
  placesT = setTimeout(async () => {
    try {
      const preds = await host.placesAutocomplete(q);
      if (S.prof.q !== q) return;
      S.prof.predictions = Array.isArray(preds) ? preds : [];
      S.prof.placesErr = '';
    } catch (e) {
      if (S.prof.q !== q) return;
      S.prof.predictions = [];
      const code = e && e.errorCode ? String(e.errorCode) : '';
      const msg = errMsg(e, 'Address search failed');
      if (code === 'MISSING_GOOGLE_MAPS_API_KEY') {
        S.prof.placesErr = 'GOOGLE_MAPS_API_KEY is missing on the server. Add it in Vercel and redeploy.';
      } else {
        // Show Google's exact denial reason (often more useful than REQUEST_DENIED alone).
        S.prof.placesErr = msg;
      }
    } finally {
      if (S.prof.q === q) S.prof.searching = false;
      renderMain();
      const inp = root.querySelector('[data-k="prof.q"]');
      if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
    }
  }, 220);
}
const fmtCallClock = (secs) => {
  const s = Math.max(0, Math.floor(secs || 0));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
const fmtAudio = (secs) => {
  const s = Math.max(0, Math.floor(secs || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
function activeCallBlock() {
  const ac = callHostData().activeCall;
  if (!ac) return '';
  const started = new Date(ac.startedAt).getTime();
  const secs = Number.isFinite(started) ? Math.max(0, Math.floor((Date.now() - started) / 1000)) : 0;
  const ts = S.transferState || ac.transferState || null;
  const row = (dot, label) => `<div class="r1"><span class="cdot ${dot}"></span><span class="lab">${label}</span><span class="tm" id="ctm">${fmtCallClock(secs)}</span></div>`;
  let body;
  if (ts === 'connecting') {
    body = row('amber', '<b>Connecting Ryan…</b>') + `<div class="r2"><button class="lnkbtn" data-act="cancelTransfer">Cancel</button></div>`;
  } else if (ts === 'connected') {
    body = row('green', '<b>Ryan is on the call</b>')
      + `<div class="r2"><button class="btn sm ghost" data-act="leaveCall" style="border-color:var(--line)" ${isBusy('call') ? 'disabled' : ''}>Leave call</button><button class="btn sm endcall" data-act="endCall" ${isBusy('call') ? 'disabled' : ''}>End call</button></div>`
      + `<div class="meta" style="margin-top:6px">You can drop off — Ryan and the lead will stay connected.</div>`;
  } else {
    body = row('red', 'Recording') + `<div class="r2"><button class="btn sm ghost" data-act="transferCall" style="border-color:var(--line)" ${isBusy('call') ? 'disabled' : ''}>Transfer to Ryan →</button><button class="btn sm endcall" data-act="endCall" ${isBusy('call') ? 'disabled' : ''}>End call</button></div>`;
  }
  return `<div class="callsec" id="callsec" role="status" aria-live="polite">${body}</div>`;
}
function notesBlock(l) {
  const dis = isBusy('save') ? 'disabled' : '';
  const steps = l.playbook_steps || [];
  const stepRow = (s) => s.status === 'done'
    ? `<li class="done"><span class="cbx on">${ic('check', 'xs')}</span><span>${esc(s.title)}</span><span class="meta">Done</span></li>`
    : s.status === 'current'
      ? `<li><span class="cbx"></span><span>${esc(s.title)}</span><button class="btn sm" data-act="pbComplete" ${dis}>Complete</button><button class="btn sm ghost" data-act="pbSkip" ${dis}>Skip</button></li>`
      : `<li><span class="cbx"></span><span>${esc(s.title)}</span><span class="meta">Up next</span></li>`;
  return steps.length ? `<ul class="steps tl">${steps.map(stepRow).join('')}</ul>` : '<div class="meta">No next steps yet.</div>';
}
function fmtBookerTime(totalSecs) {
  const s = Math.max(0, Math.floor(Number(totalSecs) || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m <= 0) return `${r} sec`;
  return `${m} min ${r} sec`;
}
function callOutcome(call) {
  if (!call.status || call.status === 'no-answer' || call.status === 'failed') return 'No answer';
  if (call.meta && call.meta.call_type === 'ryan') return "Ryan's sales call";
  if (call.transfer_status === 'connected') return 'Transferred to Ryan';
  if (call.meta && call.meta.no_show) return 'No show';
  if (call.status === 'completed' || call.status === 'summarized' || call.status === 'transcript_ready' || call.status === 'recording_ready' || call.status === 'lead_leg_done') return 'Booker call';
  return 'Call';
}
const OUTCOME_CHIP = {
  'No answer': 'chip-muted',
  'Booker call': 'chip-teal',
  'Transferred to Ryan': 'chip-green',
  "Ryan's sales call": 'chip-warm',
  'No show': 'chip-hot',
  Call: 'chip-muted',
};
function outcomeChip(label) {
  const cls = OUTCOME_CHIP[label] || 'chip-muted';
  return `<span class="chip ${cls}">${esc(label)}</span>`;
}
function fmtCallWhen(iso) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  const day = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/Toronto' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Toronto' });
  return `${day} · ${time}`;
}
function callUiState(id) {
  if (!S.callUi[id]) S.callUi[id] = { open: false, tr: false, edit: false, draft: null };
  return S.callUi[id];
}
function leadCallsAsc() {
  const raw = callHostData().calls;
  return Array.isArray(raw) ? raw : [];
}
function callCard(call, n) {
  const id = String(call.id);
  const ui = callUiState(id);
  const secs = Number(call.booker_call_seconds);
  const bookerPill = Number.isFinite(secs) && secs > 0
    ? `<span class="bpill">Gene · ${esc(fmtBookerTime(secs))}</span>`
    : '';
  const head = `<button type="button" class="chead" data-act="toggleCallCard" data-id="${esc(id)}" aria-expanded="${ui.open ? 'true' : 'false'}"><span class="cnum">#${n}</span><span class="cwhen">${esc(fmtCallWhen(call.created_at))}</span><span class="cchips">${bookerPill}</span><span class="cchev">${ic('chev', 'sm')}</span></button>`;
  if (!ui.open) return `<article class="ccard">${head}</article>`;

  const summaryText = String(ui.edit && ui.draft != null ? ui.draft : (call.summary || '')).trim();
  const summaryUi = ui.edit
    ? `<div class="sumedit"><textarea class="input" data-call-sumta="${esc(id)}" aria-label="Edit summary">${esc(summaryText)}</textarea><div class="r"><button type="button" class="btn sm" data-act="cancelCallSummary" data-id="${esc(id)}">Cancel</button><button type="button" class="btn sm primary" data-act="saveCallSummary" data-id="${esc(id)}" ${isBusy('save') ? 'disabled' : ''}>Save</button></div></div>`
    : `<div class="sumbox"><button type="button" class="edl" data-act="editCallSummary" data-id="${esc(id)}">Edit</button><p>${summaryText ? esc(summaryText) : '<span class="meta">No summary yet.</span>'}</p></div>`;

  const playUrl = call.recording_url ? `/api/twilio/recording?callId=${encodeURIComponent(id)}` : '';
  const recUi = playUrl
    ? `<div class="flabel" style="margin-top:12px">Recording</div>
  <audio data-call-audio="${esc(id)}" src="${esc(playUrl)}" preload="metadata" hidden></audio>
  <div class="player"><button type="button" class="pbtn" data-act="toggleCallPlay" data-id="${esc(id)}" aria-label="Play recording">${ic('play', 'xs')}</button><div class="prog" data-act="seekCallAudio" data-id="${esc(id)}" role="slider" tabindex="0" aria-label="Seek" aria-valuemin="0" aria-valuemax="0" aria-valuenow="0"><i data-prog-fill="${esc(id)}"></i></div><span class="pdur" data-pdur="${esc(id)}">0:00</span><a class="iconbtn" href="${esc(playUrl)}" target="_blank" rel="noopener" download aria-label="Download recording" title="Download">${ic('dl', 'sm')}</a></div>`
    : '';

  const transcript = String(call.transcript || '').trim();
  const trUi = transcript
    ? `<button type="button" class="disc" data-act="toggleCallTranscript" data-id="${esc(id)}" aria-expanded="${ui.tr ? 'true' : 'false'}">Full transcript ${ic('chev', 'xs')}</button>
  <div class="trwrap ${ui.tr ? 'open' : ''}"><div><div class="trbox" data-scroll="callTranscript-${esc(id)}" tabindex="0" aria-label="Call transcript">${esc(transcript)}</div>
  <div class="trmeta">Transcribed by Whisper · ${esc(fmtCallWhen(call.created_at).split(' · ')[0] || shortDate(call.created_at))}</div></div></div>`
    : '';

  return `<article class="ccard open">${head}<div class="cbody">
    <div class="flabel">AI summary</div>${summaryUi}${recUi}${trUi}
  </div></article>`;
}
function callsPane() {
  const calls = leadCallsAsc();
  if (!calls.length) {
    return `<div class="empty" style="padding:64px 20px"><span class="eic">${ic('phone')}</span><span class="meta" style="font-size:var(--t-sm)">No calls recorded yet</span></div>`;
  }
  const numbered = calls.map((c, i) => ({ call: c, n: i + 1 }));
  const newestFirst = [...numbered].reverse();
  return `<div class="calls">${newestFirst.map(({ call, n }) => callCard(call, n)).join('')}</div>`;
}
function bookSectionStatus(l) {
  const booking = activeCrmBooking(l);
  if (booking) {
    const startIso = booking.slot_start || booking.slotStart || l.call_start_iso || '';
    const label = booking.label || booking.call_booking || l.call_booking
      || (startIso ? slotConfirmLabel({ start: startIso }) : '');
    if (label) return `<span style="color:#2d6a4f">${esc(label)}</span>`;
  }
  if (l.call_booking || l.call_start_iso) {
    const label = l.call_booking || (l.call_start_iso ? slotConfirmLabel({ start: l.call_start_iso }) : '');
    if (label) return `<span style="color:#2d6a4f">${esc(label)}</span>`;
  }
  return 'Not booked';
}
function profileSectionStatus(l) {
  const addr = String(l.property_address || '').trim();
  if (!addr) return '<span style="color:#9a9590">Not filled in</span>';
  const short = addr.split(',')[0].trim().slice(0, 25);
  return esc(short);
}
function saleSectionStatus(l) {
  const parts = [
    STATUS_LABEL[l.status] || l.status,
    l.plan,
    contractLabel(l.contract_status) || l.contract_status,
  ].filter(Boolean);
  if (parts.length) return esc(parts.join(' · '));
  return '<span style="color:#c4891a">Not recorded</span>';
}
function notesSectionStatus(l) {
  const steps = Array.isArray(l.playbook_steps) ? l.playbook_steps : [];
  const n = steps.filter((s) => s.status !== 'done').length;
  if (n === 0) return '✓ All done';
  return `${n} task${n > 1 ? 's' : ''}`;
}
function leadPanel(l) {
  const hl = l.status === 'won' || Boolean(l.onboarding);
  const sections = [
    sectionWrap('book', 'Book a call', bookSectionStatus(l), bookBlock(l), false),
    sectionWrap('profile', 'Property profile', profileSectionStatus(l), profileBlock(l), false),
    sectionWrap('sale', 'Sale & contract', saleSectionStatus(l), saleSectionBody(l, hl), false),
    sectionWrap('notes', 'Team & AI', notesSectionStatus(l), `${notesBlock(l)}${aiBlock(l)}`, false),
  ];
  const active = activeCallBlock();
  const nCalls = leadCallCount(l.id);
  const callsLabel = nCalls > 0 ? `Calls (${nCalls})` : 'Calls';
  const detailsBody = `${active}${sections.join('')}`;
  const rightBody = S.rtab === 'calls' ? `${active}${callsPane()}` : detailsBody;
  return `<div class="card lpanel t-${S.ptab} r-${S.rtab}">${leadHeader(l)}
    <div class="plseg"><div class="pseg three" role="tablist">
      <button role="tab" data-act="ptab" data-v="chat" class="${S.ptab === 'chat' ? 'on' : ''}">Chat</button>
      <button role="tab" data-act="ptab" data-v="details" class="${S.ptab === 'details' ? 'on' : ''}">Details</button>
      <button role="tab" data-act="ptab" data-v="calls" class="${S.ptab === 'calls' ? 'on' : ''}">${esc(callsLabel)}</button>
    </div></div>
    <div class="thread">${thread(l)}</div>
    <div class="details">
      ${leadTopBar(l)}
      <div class="rtabs" role="tablist"><div class="seg">
        <button type="button" role="tab" data-act="rtab" data-v="details" class="${S.rtab === 'details' ? 'on' : ''}">Details</button>
        <button type="button" role="tab" data-act="rtab" data-v="calls" class="${S.rtab === 'calls' ? 'on' : ''}">Calls${nCalls > 0 ? ` <span class="count">${nCalls}</span>` : ''}</button>
      </div></div>
      <div class="psecs" data-scroll="details">${rightBody}</div>
    </div></div>`;
}
function leadView() {
  const l = leadById(S.leadId);
  const list = filtered();
  const listcol = `<div class="listcol">
      <div class="filters" style="margin-bottom:8px"><div class="search">${ic('search', 'sm')}<input class="input" type="search" data-k="f.q" value="${esc(S.f.q)}" placeholder="Search leads" aria-label="Search leads"></div>${refreshBtn()}</div>
      <div class="filters">${chipSeg()}<button class="btn sm ${filterCount() ? 'filtbtn on' : ''}" style="height:36px;display:inline-flex" data-act="filters">${ic('filter', 'xs')}Filters${filterCount() ? ` · ${filterCount()}` : ''}</button></div>
      <div class="card clist" data-scroll="clist">${list.length ? list.map(crow).join('') : `<div class="empty" style="padding:24px"><b style="font-size:var(--t-sm)">${S.f.needs && !filterCount() ? 'All caught up' : 'No leads match'}</b></div>`}</div></div>`;
  if (!l) {
    const body = !S.loaded ? `<div class="card"><div class="empty"><span class="refreshing"><i class="spin"></i>Loading lead…</span></div></div>`
      : emptyCard('search', 'This lead was not found', 'It may have been deleted.', '<button class="btn sm" data-act="closeLead" style="margin-top:6px">Back to contacts</button>');
    return `<div class="split">${listcol}<div>${body}</div></div>`;
  }
  return `<div class="split">${listcol}${leadPanel(l)}</div>`;
}

/* =========================================================
   Knowledge
   ========================================================= */
const isPasted = (d) => /\.md$/i.test(d.filename || '');
function kst(d) {
  if (d.status === 'ready') return `<button class="kst ok" data-act="kEdit" data-id="${esc(d.id)}">${ic('check', 'xs')}Ready · tap to edit</button>`;
  if (d.status === 'processing') return '<span class="kst wait"><i class="spin"></i>Processing…</span>';
  return `<span class="kst bad" title="${esc(d.error || '')}">${ic('alert', 'xs')}Failed <button class="btn sm" data-act="kRetry" data-id="${esc(d.id)}" ${isBusy('kUp') ? 'disabled' : ''}>Retry</button></span>`;
}
function krow(d) {
  const meta = `${isPasted(d) ? 'Pasted text' : 'Uploaded'} · ${shortDate(d.created_at)}${d.status === 'failed' && d.error ? ' · ' + d.error : ''}`;
  return `<div class="krow"><span class="kic">${ic(isPasted(d) ? 'text' : 'file', 'sm')}</span>
    <button class="kmain" data-act="kEdit" data-id="${esc(d.id)}"><b>${esc(d.title || d.filename || 'Untitled')}</b><span class="meta">${esc(meta)}</span></button>
    ${kst(d)}
    <span class="kact">${d.status === 'ready' ? `<button class="switch ${d.active ? 'on' : ''}" role="switch" aria-checked="${Boolean(d.active)}" aria-label="${d.active ? 'Turn off' : 'Turn on'} ${esc(d.title)}" data-act="kToggle" data-id="${esc(d.id)}"><i></i></button>${d.active ? 'Active' : 'Off'}` : '<span class="meta">Active after ready</span>'}</span>
    <button class="iconbtn" data-act="kDelete" data-id="${esc(d.id)}" aria-label="Delete ${esc(d.title)}">${ic('trash', 'sm')}</button></div>`;
}
const fileInput = (k) => `<input type="file" accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown" data-file="${k}" hidden>`;
function knowledgeView() {
  const busy = isBusy('kUp');
  const docs = S.docs;
  const active = docs.filter((d) => d.active).length;
  const add = `<div class="card kadd" style="margin-bottom:14px"><div class="cardhead kadd-head"><h3>Add to knowledge</h3><span class="meta">The AI reads this before it talks to leads.</span></div>
    <div class="cardbody"><div class="kaddgrid">
      <label class="drop ${busy ? 'busy' : ''}">${fileInput('kUpload')}${busy ? '<i class="spin"></i>' : ic('upload')}Upload a file<span class="meta">PDF, DOCX or TXT</span></label>
      <div class="kpaste"><input class="input" data-k="kUp.title" value="${esc(S.kUp.title)}" placeholder="Title (used for the upload or the pasted text)" aria-label="Title"><textarea class="input" data-k="kUp.text" placeholder="Paste text the AI should know…" aria-label="Text">${esc(S.kUp.text)}</textarea><div style="display:flex;justify-content:flex-end"><button class="btn primary sm" data-act="kAddPaste" ${busy ? 'disabled' : ''}>${ic('plus', 'xs')}Add pasted text</button></div></div>
    </div></div></div>
    <div class="kphone"><label class="btn ${busy ? 'dis' : ''}">${fileInput('kUpload')}${ic('upload', 'sm')}Upload file</label><button class="btn" data-act="kPasteSheet">${ic('text', 'sm')}Paste text</button></div>`;
  const err = S.docsErr ? `<div class="warnbox" style="margin:0 0 12px">${ic('alert', 'sm')}<span>${esc(S.docsErr)}</span></div>` : '';
  const list = !S.docsLoaded ? `<div class="empty"><span class="refreshing"><i class="spin"></i>Loading documents…</span></div>`
    : docs.length ? docs.map(krow).join('')
    : `<div class="empty"><span class="eic">${ic('book')}</span><b>No documents yet</b><span>Upload a file or paste text so the AI can answer owner questions.</span></div>`;
  return `${add}${err}<div class="card"><div class="cardhead"><h3>Documents <span class="count">${docs.length}</span></h3><span class="meta">${active} active</span></div>${list}</div>`;
}

function formatBookingWhen(iso) {
  const d = new Date(iso || 0);
  if (!iso || Number.isNaN(d.getTime())) return String(iso || '');
  const day = d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${day} · ${time}`;
}
const STOP_LINE = 'Reply STOP to opt out.';
function welcomeTemplates() {
  const raw = (S.settings && S.settings.welcome_message_templates) || [];
  return Array.isArray(raw) ? raw.slice() : [];
}
function truncMsg(s) {
  const t = String(s || '');
  return t.length > 100 ? `${t.slice(0, 100).trimEnd()}...` : t;
}
function newTplId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `w_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
function tplCard(t) {
  const def = Boolean(t.is_default) || !String(t.trigger || '').trim();
  const chip = def
    ? `<span class="tplchip def">Fires for all other lead sources</span>`
    : `<span class="tplchip">${esc(t.trigger)}</span>`;
  const ask = S.wm.askDel && String(S.wm.askDel) === String(t.id);
  return `<article class="tpl" data-id="${esc(t.id)}"><div class="r1"><b>${esc(t.name)}</b>${def ? '<span class="defbadge">Default</span>' : ''}<span class="sp"></span></div>
   <div class="trig">${def ? '' : '<span>Fires when lead source contains:</span>'}${chip}</div>
   <div class="msg">${esc(truncMsg(t.message))}</div>
   <div class="stop">Reply STOP to opt out. Appended automatically.</div>
   ${ask ? `<div class="ask"><span>Delete <b>${esc(t.name)}</b>? Leads from this source get the default message instead.</span><button class="btn sm" data-act="wmKeep">Keep</button><button class="btn sm danger" data-act="wmDelYes" data-id="${esc(t.id)}">Delete</button></div>`
   : `<div class="acts"><button class="btn sm ghost" data-act="wmEdit" data-id="${esc(t.id)}">${ic('edit', 'xs')}Edit</button><button class="btn sm ghostred" data-act="wmDel" data-id="${esc(t.id)}" ${def ? 'disabled title="The default template can’t be deleted"' : ''}>${ic('trash', 'xs')}Delete</button></div>`}</article>`;
}
function welcomeView() {
  const loaded = Boolean(S.settings);
  const list = welcomeTemplates();
  const ordered = [...list.filter((t) => String(t.trigger || '').trim() && !t.is_default), ...list.filter((t) => t.is_default || !String(t.trigger || '').trim())];
  const cards = !loaded
    ? `<div class="meta" style="display:flex;gap:6px;align-items:center"><i class="spin"></i>Loading templates…</div>`
    : ordered.length
      ? `<div class="tpls">${ordered.map(tplCard).join('')}</div>`
      : `<div class="empty"><span class="eic">${ic('sms')}</span><b>No welcome templates yet</b><span>Add one so new leads get a first text matched to their ad source.</span></div>`;
  return `<div class="wmhead"><div><h2>Welcome messages</h2><p>The first text a lead receives depends on which ad or form they came from. Reply STOP to opt out is always appended automatically.</p></div>
   <button class="btn primary" data-act="wmNew" ${!loaded || isBusy('welcome') ? 'disabled' : ''}>${ic('plus', 'sm')}New template</button></div>${cards}`;
}
function welcomeTplForm() {
  const w = S.wm;
  const previewMsg = String(w.message || 'Your message shows here.');
  const previewHtml = `${esc(previewMsg).replace(/\{name\}/gi, '<mark>Casey</mark>')}<br><span class="s">${esc(STOP_LINE)}</span>`;
  const count = previewMsg.replace(/\{name\}/gi, 'Casey').length + 1 + STOP_LINE.length;
  const blankTrig = !String(w.trigger || '').trim();
  const otherDefault = welcomeTemplates().find((t) => (t.is_default || !String(t.trigger || '').trim()) && String(t.id) !== String(w.id || ''));
  const trigBad = blankTrig && otherDefault;
  const trigHint = trigBad
    ? `“${otherDefault.name}” is already the default. Add a campaign name, or edit that template instead.`
    : 'Leave blank to use as the default template';
  return `<form class="modal frost" id="wmForm" role="dialog" aria-modal="true" aria-labelledby="wmTitle" novalidate>
    <div class="mhead"><div><h2 id="wmTitle">${w.id ? 'Edit template' : 'New template'}</h2><p class="lede">This is the first text a lead gets from the matching source.</p></div><button type="button" class="iconbtn" data-act="closeModal" aria-label="Close">${ic('x')}</button></div>
    <div class="mform">
      <div class="field"><label for="wmName">Template name</label><input class="input${w.nameErr ? ' warn' : ''}" id="wmName" data-k="wm.name" value="${esc(w.name)}" placeholder="e.g. STR Management Ad">${w.nameErr ? `<div class="hint bad">${esc(w.nameErr)}</div>` : ''}</div>
      <div class="field"><label for="wmTrig">Trigger <em>· campaign name</em></label><input class="input" id="wmTrig" data-k="wm.trigger" value="${esc(w.trigger)}" placeholder="e.g. meta_make:strmgmt" style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px"><div class="hint${trigBad ? ' bad' : ''}">${esc(trigHint)}</div></div>
      <div class="field"><label for="wmMsg">Message</label><div class="taw"><textarea class="input" id="wmMsg" rows="4" data-k="wm.message">${esc(w.message)}</textarea><span class="cc${count > 160 ? ' over' : ''}">${count} / 160</span></div><div class="hint">Use {name} to personalise with the lead’s first name.</div></div>
      <div class="prev"><div class="pl">Preview</div><div class="pb">${previewHtml}</div></div>
    </div>
    <div class="mfoot"><button type="button" class="btn" data-act="closeModal">Cancel</button><button type="submit" class="btn primary" ${isBusy('welcome') ? 'disabled' : ''}>${isBusy('welcome') ? 'Saving…' : 'Save template'}</button></div>
  </form>`;
}

/* =========================================================
   Settings
   ========================================================= */
function settingsView() {
  const st = S.settings || {};
  const set = S.set;
  const loaded = Boolean(S.settings);
  const autoOn = Boolean(st.ai_responses_enabled) && !envKill();
  const sAuto = `<div class="card"><div class="cardbody setrow setrow-top"><span class="setcopy"><b>Auto-reply to new SMS</b><span class="meta">When on, the AI answers new texts using each chat’s AI setting. When off, every chat waits for the team, unless you enable AI on one lead.${envKill() ? ' The server kill switch is on and overrides this.' : ''}</span></span><button class="switch ${autoOn ? 'on' : ''}" role="switch" aria-checked="${autoOn}" aria-label="Auto-reply to new SMS" data-act="toggleAuto" ${!loaded || envKill() || isBusy('globalAi') ? 'disabled' : ''}><i></i></button></div></div>`;
  const p = set.preview;
  let prev = '';
  if (p && p.parsed) {
    const pr = p.parsed;
    const rows = [
      ['Name', pr.name], ['Phone', pr.phone ? fmtPhone(pr.phone) : ''], ['Email', pr.email], ['Address', pr.address],
      ['Has listing', pr.hasListing === 'yes' ? 'Yes' : pr.hasListing === 'no' ? 'No' : ''], ['Listing', pr.listingTitle],
      ['Process stage', PROCESS_LABEL[pr.propertyStage] || pr.propertyStage], ['STR allowed', STR_LABEL[pr.strAllowed] || pr.strAllowed],
      ['Earnings', pr.earnings], ['Path', OFFER_PATH_LABEL[pr.offerPath] || pr.offerPath],
      ['Lands as', p.decision ? `${STATUS_LABEL[p.decision.status] || p.decision.status}${p.decision.reason ? ' · ' + p.decision.reason : ''}` : ''],
    ].filter(([, v]) => v);
    prev = `<span class="flabel">Preview</span><dl class="ptable">${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
      ${p.duplicate ? `<div class="warnbox">${ic('alert', 'sm')}<span><b>Already in the CRM:</b> ${esc(p.duplicate.name)} (${esc(STATUS_LABEL[p.duplicate.status] || p.duplicate.status)}). Importing updates that lead.</span></div>` : ''}
      ${(pr.warnings || []).map((w) => `<div class="warnbox">${ic('alert', 'sm')}<span>${esc(w)}</span></div>`).join('')}`;
  }
  const pBusy = isBusy('paste');
  const pasteDisabled = pBusy || !set.paste.trim();
  const sMeta = `<div class="card"><div class="cardhead"><h3>${ic('users', 'sm')}Paste a Meta lead</h3></div><div class="cardbody">
    <textarea class="input pastebox" style="min-height:120px" data-k="set.paste" placeholder="Paste the lead from Meta here, one field per line…" aria-label="Meta lead text">${esc(set.paste)}</textarea>
    ${prev}
    ${set.pErr ? `<div class="hint bad">${ic('alert', 'xs')}${esc(set.pErr)}</div>` : ''}
    ${set.pMsg ? `<div class="okbox">${ic('check', 'sm')}<span>${esc(set.pMsg)}</span></div>` : ''}
    <div class="paste-actions"><button class="btn sm${pasteDisabled ? ' dis' : ''}" data-act="pastePreview" ${pasteDisabled ? 'disabled' : ''}>${ic('eye', 'xs')}Preview</button><button class="btn primary sm${pasteDisabled ? ' dis' : ''}" data-act="pasteImport" ${pasteDisabled ? 'disabled' : ''}>${ic('plus', 'sm')}${pBusy ? 'Working…' : 'Import lead'}</button></div></div></div>`;
  const active = activeCallerPhone();
  const callback = callbackPhone();
  const callers = teamCallers();
  // Only match active_caller_phone to a roster row. No active (or no match) → Custom.
  const matchedFromActive = active ? (callers.find((c) => samePhone(c.phone, active)) || null) : null;
  const callerSel = set.callerSel;
  const customMode = callerSel === 'custom' || (callerSel == null && !matchedFromActive);
  const selectVal = customMode
    ? '__custom__'
    : String(callerSel || (matchedFromActive && matchedFromActive.phone) || '__custom__');
  const callerOpts = [
    ...callers.map((c) => `<option value="${esc(c.phone)}" ${samePhone(c.phone, selectVal) ? 'selected' : ''}>${esc(c.name)} · ${esc(fmtPhone(c.phone))}</option>`),
    `<option value="__custom__" ${customMode ? 'selected' : ''}>Custom number</option>`,
  ].join('');
  const displayOp = set.op || (customMode ? (active || callback) : selectVal);
  const saveOpDisabled = isBusy('op') || !set.opDirty;
  const warnPhone = customMode ? displayOp : selectVal;
  const sCalls = `<div class="card"><div class="cardhead"><h3>${ic('phone', 'sm')}CRM calls</h3></div><div class="cardbody" style="display:flex;flex-direction:column;gap:12px">
    <div class="field"><label for="ringFirst">Whose phone rings first</label><select id="ringFirst" class="input" data-sel="ringFirst" aria-describedby="ringFirstHint">${callerOpts}</select><div class="hint" id="ringFirstHint">Twilio rings this phone first, then connects the lead. Add numbers on the OPS Employees roster.</div></div>
    ${customMode ? `<div class="field"><label for="opPhone">Custom number</label><input id="opPhone" class="input" type="tel" inputmode="tel" autocomplete="tel" data-k="set.op" value="${esc(displayOp)}" placeholder="Business line or your cell"><div class="hint">Rings first, then connects to the lead. Calls are recorded. Don’t use the Twilio SMS number.</div></div>` : ''}
    ${isTwilioSender(warnPhone) ? `<div class="warnbox">${ic('alert', 'sm')}<span><b>This is the Twilio SMS number.</b> Use the business line or a cell instead.</span></div>` : ''}
    <div style="display:flex;justify-content:flex-end;align-items:center;gap:10px">${set.opMsg ? `<span class="meta">${esc(set.opMsg)}</span>` : ''}<button class="btn primary sm${saveOpDisabled ? ' dis' : ''}" data-act="saveOp" ${saveOpDisabled ? 'disabled' : ''}>${isBusy('op') ? 'Saving…' : 'Save'}</button></div></div></div>`;
  const recips = Array.isArray(st.lead_notify_recipients) && st.lead_notify_recipients.length ? st.lead_notify_recipients
    : String(st.lead_notify_phone || '').split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean).map((phone, i) => ({ id: `legacy_${i}_${phone}`, name: '', phone, welcome_sent_at: null }));
  const nb = isBusy('notify');
  const person = (r) => `<li><span class="av sm" style="background:${r.name ? `oklch(0.5 0.11 ${AVC[hashIdx(r.id)]})` : 'oklch(0.55 0.01 270)'}">${r.name ? esc(initials(r.name)) : '?'}</span><span class="t"><b>${esc(r.name || fmtPhone(r.phone))}</b>${r.name ? `<span class="meta">${esc(fmtPhone(r.phone))}</span>` : ''}${r.welcome_sent_at ? '' : '<span class="meta" style="color:var(--amberink);display:block">Re-save with a name to verify</span>'}</span>
    ${r.welcome_sent_at ? chip('Verified', 155, .13) : `<button class="btn sm" data-act="notifyVerify" data-phone="${esc(r.phone)}" data-name="${esc(r.name || '')}" ${nb ? 'disabled' : ''}>Verify</button>`}<button class="btn sm ghost" data-act="notifyRemove" data-id="${esc(r.id)}" ${nb ? 'disabled' : ''}>Remove</button></li>`;
  const sAlerts = `<div class="card"><div class="cardhead"><h3>${ic('bell', 'sm')}New lead text alerts</h3><button class="switch ${st.lead_notify_sms_enabled ? 'on' : ''}" role="switch" aria-checked="${Boolean(st.lead_notify_sms_enabled)}" aria-label="New lead text alerts" data-act="notifyToggle" ${!loaded || nb ? 'disabled' : ''}><i></i></button></div><div class="cardbody">
    <div class="hint" style="margin:0 0 6px">A text with the lead’s details and a link to the contact, sent to everyone below.</div>
    ${recips.length ? `<ul class="people">${recips.map(person).join('')}</ul>` : '<div class="meta" style="padding:6px 0">Nobody gets alerts yet.</div>'}
    <div class="addrow"><input class="input" data-k="set.nName" value="${esc(set.nName)}" placeholder="Name" aria-label="Name"><input class="input" type="tel" inputmode="tel" data-k="set.nPhone" value="${esc(set.nPhone)}" placeholder="Phone" aria-label="Phone"><button class="btn" data-act="notifyAdd" ${nb || !set.nPhone.trim() ? 'disabled' : ''}>${ic('plus', 'sm')}Add person</button></div>
    ${set.nMsg ? `<div class="hint">${esc(set.nMsg)}</div>` : ''}</div></div>`;
  const codes = Array.isArray(st.unlock_codes) ? st.unlock_codes : [];
  const ub = isBusy('unlock');
  const createCodeDisabled = ub || set.uCode.trim().length < 4;
  const codeRow = (c) => `<li><span class="t"><span class="code">${esc(c.code)}</span>${c.label ? `<span class="code-label meta">${esc(c.label)}</span>` : ''}<span class="meta" style="display:block">${c.redeemed_at ? `Created ${esc(shortDate(c.created_at))} · used ${esc(shortDate(c.redeemed_at))}${c.redeemed_by_email ? ' · ' + esc(c.redeemed_by_email) : ''}` : `Created ${esc(shortDate(c.created_at))} · not used`}</span></span>${c.redeemed_at ? chip('Used', 270, .02) : `<button class="iconbtn" data-act="copyCode" data-code="${esc(c.code)}" aria-label="Copy code ${esc(c.code)}" title="Copy code">${ic('copy', 'xs')}</button>`}</li>`;
  const sCodes = `<div class="card"><div class="cardhead"><h3>${ic('key', 'sm')}Revenue audit unlock codes</h3><button class="btn sm primary${createCodeDisabled ? ' dis' : ''}" data-act="createCode" ${createCodeDisabled ? 'disabled' : ''}>${ic('plus', 'xs')}${ub ? 'Saving…' : 'Create code'}</button></div><div class="cardbody">
    <div class="hint" style="margin:0 0 10px">One-time code a client enters to unlock their revenue audit.</div>
    <div class="addrow" style="grid-template-columns:1fr 1fr;margin:0 0 10px"><input class="input" data-k="set.uCode" value="${esc(set.uCode)}" placeholder="Code, at least 4 characters" aria-label="Code" style="text-transform:uppercase"><input class="input" data-k="set.uLabel" value="${esc(set.uLabel)}" placeholder="Client name (optional)" aria-label="Client name"></div>
    ${set.uMsg ? `<div class="hint" style="margin:0 0 8px">${esc(set.uMsg)}</div>` : ''}
    ${codes.length ? `<ul class="people">${codes.map(codeRow).join('')}</ul>` : '<div class="empty" style="padding:18px"><b style="font-size:var(--t-sm)">No codes yet</b></div>'}</div></div>`;
  const loading = !loaded ? `<div class="meta" style="margin-bottom:12px;display:flex;gap:6px;align-items:center"><i class="spin"></i>Loading settings…</div>` : '';
  return `${loading}<div class="setgrid"><div class="setcol">${sAuto}${sCalls}${sAlerts}</div><div class="setcol">${sMeta}${sCodes}</div></div>`;
}

/* =========================================================
   Overlays: + Lead, delete, filters, editor, paste, Ctrl+K
   ========================================================= */
function nlHints() {
  const n = S.nl; if (!n) return { name: '', phone: '' };
  const clean = n.name.replace(/\s+/g, ' ').trim();
  const d = digitsOf(n.phone).replace(/^1(?=\d{10}$)/, '');
  return {
    name: clean ? `${ic('check', 'xs')}Saves as ${esc(clean)}` : '',
    nameCls: 'good',
    phone: !n.phone.trim() ? '' : d.length === 10 ? `${ic('check', 'xs')}Saves as ${esc(fmtPhone(d))}` : `${ic('alert', 'xs')}Check the number: a 10 digit CA/US phone`,
    phoneCls: d.length === 10 ? 'good' : 'warn',
  };
}
function newLeadForm() {
  const n = S.nl, h = nlHints();
  return `<form class="modal frost" id="nlForm" role="dialog" aria-modal="true" aria-labelledby="nlTitle" novalidate><h2 id="nlTitle">New lead</h2><p class="lede">Saves at the New stage with the AI paused.</p>
    <div class="fgrid">
      <div class="field full"><label for="nlName">Name</label><input id="nlName" class="input" data-k="nl.name" value="${esc(n.name)}" placeholder="Client name" autocomplete="off"><div class="hint ${h.nameCls}" data-hint="name">${h.name}</div></div>
      <div class="field"><label for="nlPhone">Phone</label><input id="nlPhone" class="input" type="tel" inputmode="tel" data-k="nl.phone" value="${esc(n.phone)}" placeholder="Any format"><div class="hint ${h.phoneCls}" data-hint="phone">${h.phone}</div></div>
      <div class="field"><label for="nlEmail">Email</label><input id="nlEmail" class="input" type="email" inputmode="email" data-k="nl.email" value="${esc(n.email)}" placeholder="Email address"></div>
      <div class="field full"><label for="nlAddr">Property address <em>(optional)</em></label><input id="nlAddr" class="input" data-k="nl.address" value="${esc(n.address)}" placeholder="Start typing an address…"></div>
      <div class="field"><label for="nlSrc">Source</label><select id="nlSrc" class="input" data-sel="nl.source">${LEAD_SOURCES.map((s) => opt(s, s, n.source)).join('')}</select></div>
      ${n.source === 'Referral' ? `<div class="field"><label for="nlRef">Referred by</label><input id="nlRef" class="input" data-k="nl.referredBy" value="${esc(n.referredBy)}" placeholder="Who referred them"><div class="hint">Shown for Referral only</div></div>` : ''}
      <div class="field full"><label for="nlNotes">Notes <em>(optional)</em></label><textarea id="nlNotes" class="input" style="min-height:64px" data-k="nl.notes" placeholder="Anything from the first contact">${esc(n.notes)}</textarea></div></div>
    <div class="hint" style="margin-top:12px">${ic('pause', 'xs')}AI starts paused for manual leads. Turn it on from the lead when you’re ready.</div>
    ${n.err ? `<div class="hint bad">${ic('alert', 'xs')}${esc(n.err)}</div>` : ''}
    <div class="mfoot"><button type="button" class="btn" data-act="closeModal">Cancel</button><button type="submit" class="btn primary" id="nlSave" ${n.busy || !n.name.trim() ? 'disabled' : ''}>${n.busy ? 'Saving…' : 'Save lead'}</button></div></form>`;
}
function filterSheet() {
  const f = S.f;
  const seg = (k, opts) => `<div class="aiseg three">${opts.map(([v, l]) => `<button type="button" class="${f[k] === v ? 'on' : ''}" data-act="fset" data-f="${k}" data-v="${v}">${l}</button>`).join('')}</div>`;
  return `<div class="modal frost" role="dialog" aria-modal="true" aria-labelledby="fTitle"><h2 id="fTitle" style="font-size:18px;margin-bottom:12px">Filters</h2>
    <div style="display:flex;flex-direction:column;gap:10px">
      <div class="field"><label for="fsPath">Path</label><select id="fsPath" class="input" data-sel="f.path">${opt('all', 'All paths', f.path)}${OFFER_PATHS.map((p) => opt(p, OFFER_PATH_LABEL[p] || p, f.path)).join('')}</select></div>
      <div class="field"><label for="fsStage">Stage</label><select id="fsStage" class="input" data-sel="f.stage">${opt('all', 'All stages', f.stage)}${LEAD_STATUSES.map((s) => opt(s, STATUS_LABEL[s] || s, f.stage)).join('')}</select></div>
      <div class="field"><span class="flabel">AI</span>${seg('ai', [['all', 'All'], ['live', 'Live'], ['paused', 'Paused']])}</div>
      <div class="setrow"><b style="font-size:var(--t-sm)">Booked this week</b><button type="button" class="switch ${f.booked ? 'on' : ''}" role="switch" aria-checked="${f.booked}" aria-label="Booked this week" data-act="bookedWeek"><i></i></button></div>
      <div class="field"><span class="flabel">Sort</span>${seg('sort', [['inbox', 'Inbox'], ['newest', 'Newest'], ['oldest', 'Oldest']])}</div></div>
    <div class="mfoot"><button type="button" class="btn ghost" data-act="clearFilters">Clear filters</button><button type="button" class="btn primary" style="flex:1" data-act="closeModal">Show results</button></div></div>`;
}
function editorSheet() {
  const e = S.ed;
  return `<div class="frost editor" role="dialog" aria-modal="true" aria-labelledby="edTitle"><div class="edhead"><h2 id="edTitle">Edit document</h2><button class="iconbtn" data-act="closeModal" aria-label="Close">${ic('x')}</button></div>
    ${e.loading ? '<div class="empty"><span class="refreshing"><i class="spin"></i>Opening…</span></div>' : `<div class="field"><label for="edT">Title</label><input id="edT" class="input" data-k="ed.title" value="${esc(e.title)}"></div>
    <div class="field" style="flex:1;display:flex;flex-direction:column"><label for="edX">Content</label><textarea id="edX" class="input" data-k="ed.text">${esc(e.text)}</textarea></div>`}
    ${e.err ? `<div class="hint bad">${ic('alert', 'xs')}${esc(e.err)}</div>` : ''}
    <div class="mfoot"><button class="btn" data-act="closeModal" ${e.busy ? 'disabled' : ''}>Cancel</button><button class="btn primary" data-act="edSave" ${e.busy || e.loading ? 'disabled' : ''}>${e.busy ? 'Saving…' : 'Save'}</button></div></div>`;
}
function pasteSheet() {
  return `<div class="modal frost" role="dialog" aria-modal="true" aria-labelledby="psTitle"><h2 id="psTitle" style="font-size:18px">Paste text</h2><p class="lede">The AI uses it once it’s ready and active.</p>
    <div style="display:flex;flex-direction:column;gap:10px"><div class="field"><label for="psT">Title</label><input id="psT" class="input" data-k="kUp.title" value="${esc(S.kUp.title)}"></div>
    <div class="field"><label for="psX">Text</label><textarea id="psX" class="input" style="min-height:200px" data-k="kUp.text" placeholder="Paste text the AI should know…">${esc(S.kUp.text)}</textarea></div></div>
    <div class="mfoot"><button class="btn" data-act="closeModal">Cancel</button><button class="btn primary" data-act="kAddPaste" ${isBusy('kUp') ? 'disabled' : ''}>${ic('plus', 'sm')}Add pasted text</button></div></div>`;
}
function confirmBox() {
  const m = S.modal;
  return `<div class="modal frost narrow" role="alertdialog" aria-modal="true" aria-labelledby="cfTitle"><h2 id="cfTitle">${esc(m.title)}</h2><p class="lede">${esc(m.lede)}</p>
    <div class="mfoot"><button class="btn" data-act="closeModal">Cancel</button><button class="btn danger" data-act="confirmOk" ${m.busy ? 'disabled' : ''}>${ic('trash', 'sm')}${esc(m.okLabel)}</button></div></div>`;
}
function cmdItems() {
  const q = S.cmd.q.trim().toLowerCase();
  const qd = digitsOf(q);
  const leads = !q ? S.leads.slice(0, 6) : S.leads.filter((l) => {
    const hay = [l.name, l.email, l.address, l.listing_title].join(' ').toLowerCase();
    return hay.includes(q) || (qd.length >= 3 && digitsOf(l.phone).includes(qd));
  }).slice(0, 8);
  const acts = [
    ['newLead', 'plus', 'New lead'],
    ['tab:contacts', 'inbox', 'Contacts'],
    ['tab:knowledge', 'book', 'Knowledge'],
    ['tab:welcome', 'sms', 'Welcome messages'],
    ['go:ops:settings', 'gear', 'Settings'],
    ['tab:settings', 'gear', 'CRM Settings'],
  ].filter(([, , l]) => !q || l.toLowerCase().includes(q));
  return [...leads.map((l) => ({ kind: 'lead', l })), ...acts.map(([a, i, l]) => ({ kind: 'act', a, i, l }))];
}
function cmdResults() {
  const items = S.cmd.items = cmdItems();
  if (S.cmd.act >= items.length) S.cmd.act = Math.max(0, items.length - 1);
  let html = '', i = 0, grp = '';
  for (const it of items) {
    const g = it.kind === 'lead' ? 'Leads' : 'Actions';
    if (g !== grp) { html += `<div class="meta grp">${g}</div>`; grp = g; }
    html += it.kind === 'lead'
      ? `<button class="it ${i === S.cmd.act ? 'act' : ''}" data-ci="${i}">${av(it.l, 'sm')}<span>${esc(it.l.name || 'Unnamed lead')}</span><span class="meta">${esc([phoneUsable(it.l.phone) ? fmtPhone(it.l.phone) : '', STATUS_LABEL[it.l.status] || ''].filter(Boolean).join(' · '))}</span></button>`
      : `<button class="it ${i === S.cmd.act ? 'act' : ''}" data-ci="${i}">${ic(it.i, 'sm')}<span>${it.l}</span></button>`;
    i++;
  }
  return html || '<div class="empty" style="padding:24px"><b style="font-size:var(--t-sm)">No matches</b></div>';
}
function cmdk() {
  return `<div class="frost cmdk" role="dialog" aria-modal="true" aria-label="Jump to a lead"><div class="cmdq">${ic('search')}<input data-k="cmd.q" value="${esc(S.cmd.q)}" placeholder="Search leads by name, phone, email, address or listing" aria-label="Search leads"><kbd>esc</kbd></div><div class="cmdres" id="cmdRes">${cmdResults()}</div></div>`;
}
function renderOverlay() {
  const m = S.modal;
  const host_ = $('#ov');
  if (!m) { host_.innerHTML = ''; return; }
  const kind = m.kind;
  const cls = kind === 'editor' ? 'scrim side' : kind === 'cmdk' ? 'scrim top' : 'scrim';
  const inner = kind === 'newLead' ? newLeadForm() : kind === 'filters' ? filterSheet() : kind === 'editor' ? editorSheet() : kind === 'paste' ? pasteSheet() : kind === 'confirm' ? confirmBox() : kind === 'cmdk' ? cmdk() : kind === 'welcomeTpl' ? welcomeTplForm() : '';
  host_.innerHTML = `<div class="${cls}" id="scrim">${inner}</div>`;
}
function openModal(m, focusSel) {
  S.modal = m; S.menu = null; renderMenu(); renderOverlay();
  if (focusSel) { const el = root.querySelector(focusSel); if (el) setTimeout(() => el.focus(), 30); }
}
function closeModal() {
  if (S.modal && S.modal.kind === 'editor' && S.ed.busy) return;
  const wasFilters = S.modal && S.modal.kind === 'filters';
  S.modal = null; renderOverlay();
  if (wasFilters) renderMain();
}

/* ---------------- menus ---------------- */
function renderMenu() {
  const mh = $('#menuHost');
  const m = S.menu;
  if (!m) { mh.innerHTML = ''; return; }
  const l = leadById(m.id);
  if (!l) { S.menu = null; mh.innerHTML = ''; return; }
  const items = [];
  if (m.kind === 'row') items.push(`<button data-act="open" data-id="${esc(l.id)}">${ic('sms', 'sm')}Open</button>`);
  items.push(`<button data-act="convertClient" data-id="${esc(l.id)}">${ic('file', 'sm')}Create client and send contract</button>`);
  if (phoneUsable(l.phone)) items.push(`<button data-act="copyPhone" data-id="${esc(l.id)}">${ic('copy', 'sm')}Copy phone</button>`);
  items.push('<hr>');
  items.push(`<button class="dng" data-act="askDelete" data-id="${esc(l.id)}">${ic('trash', 'sm')}Delete contact</button>`);
  mh.innerHTML = `<div class="menu frost" role="menu" style="left:${m.x}px;top:${m.y}px">${items.join('')}</div>`;
  const el = mh.firstElementChild;
  const r = el.getBoundingClientRect();
  if (r.bottom > window.innerHeight - 8) el.style.top = Math.max(8, m.y - r.height - m.h - 8) + 'px';
}
function openMenu(kind, id, btn) {
  const r = btn.getBoundingClientRect();
  const w = 250;
  S.menu = { kind, id, x: Math.max(8, Math.min(window.innerWidth - w - 8, r.right - w)), y: r.bottom + 6, h: r.height };
  renderMenu();
}

/* =========================================================
   Render
   ========================================================= */
let lastMsgKey = '';
function renderContent() {
  const c = $('#content');
  const leadMode = S.tab === 'contacts' && Boolean(S.leadId);
  c.classList.toggle('leadmode', leadMode);
  c.innerHTML = S.tab === 'knowledge' ? knowledgeView() : S.tab === 'welcome' ? welcomeView() : S.tab === 'settings' ? settingsView() : leadMode ? leadView() : inboxView();
  const msgs = $('#msgs');
  if (msgs) {
    const key = `${S.th.id}:${S.th.messages.length}:${S.th.draft ? S.th.draft.id : ''}`;
    if (key !== lastMsgKey) { lastMsgKey = key; requestAnimationFrame(() => { const m = $('#msgs'); if (m) m.scrollTop = m.scrollHeight; }); }
  }
  sizeComposer();
}
/* Set on destroy: a load that finishes after the CRM is unmounted must not draw into the emptied root. */
let destroyed = false;
let callTick = null;
/** Snapshot so CRM re-renders (12s poll) don't kill an in-progress recording. */
let playerSnap = { src: '', t: 0, playing: false };
let transcriptScrollTop = 0;
function snapshotCallPlayer() {
  const playing = root.querySelector('[data-call-audio]:not([data-paused])') ||
    [...root.querySelectorAll('[data-call-audio]')].find((el) => !el.paused && !el.ended);
  const a = playing || root.querySelector('[data-call-audio]');
  if (a) {
    const src = a.getAttribute('src') || '';
    if (src) playerSnap = { src, t: a.currentTime || 0, playing: !a.paused && !a.ended };
  }
  const tr = root.querySelector('[data-scroll^="callTranscript"]');
  if (tr) transcriptScrollTop = tr.scrollTop || 0;
}
function ensureCallTimer() {
  const ac = callHostData().activeCall;
  if (!ac) {
    if (callTick) { clearInterval(callTick); callTick = null; }
    return;
  }
  if (callTick) return;
  callTick = setInterval(() => {
    const live = callHostData().activeCall;
    const el = root.querySelector('#ctm');
    if (!live || !el) {
      if (!live && callTick) { clearInterval(callTick); callTick = null; }
      return;
    }
    const started = new Date(live.startedAt).getTime();
    const secs = Number.isFinite(started) ? Math.max(0, Math.floor((Date.now() - started) / 1000)) : 0;
    el.textContent = fmtCallClock(secs);
  }, 1000);
}
function bindCallPlayer() {
  root.querySelectorAll('[data-call-audio]').forEach((a) => {
    const id = a.getAttribute('data-call-audio');
    if (!id) return;
    const fill = root.querySelector(`[data-prog-fill="${CSS.escape(id)}"]`);
    const dur = root.querySelector(`[data-pdur="${CSS.escape(id)}"]`);
    const btn = root.querySelector(`[data-act="toggleCallPlay"][data-id="${CSS.escape(id)}"]`);
    const prog = root.querySelector(`[data-act="seekCallAudio"][data-id="${CSS.escape(id)}"]`);
    if (!fill || !dur || !btn) return;
    const paint = () => {
      const total = a.duration || 0;
      const cur = a.currentTime || 0;
      fill.style.width = total ? `${(cur / total) * 100}%` : '0%';
      if (prog) {
        prog.setAttribute('aria-valuemax', String(Math.round(total || 0)));
        prog.setAttribute('aria-valuenow', String(Math.round(cur || 0)));
      }
      dur.textContent = total ? (cur > 0 ? `${fmtAudio(cur)} / ${fmtAudio(total)}` : fmtAudio(total)) : '0:00';
      btn.innerHTML = a.paused
        ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>'
        : '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>';
      btn.setAttribute('aria-label', a.paused ? 'Play recording' : 'Pause recording');
    };
    if (a.dataset.bound !== '1') {
      a.dataset.bound = '1';
      a.addEventListener('timeupdate', paint);
      a.addEventListener('loadedmetadata', paint);
      a.addEventListener('play', paint);
      a.addEventListener('pause', paint);
      a.addEventListener('ended', paint);
    }
    const src = a.getAttribute('src') || '';
    if (playerSnap.src && src && playerSnap.src === src && (playerSnap.t > 0.25 || playerSnap.playing)) {
      const restore = () => {
        try {
          if (playerSnap.t > 0 && Number.isFinite(a.duration) && playerSnap.t < a.duration) {
            a.currentTime = playerSnap.t;
          }
        } catch { /* seek not ready */ }
        if (playerSnap.playing) a.play().catch(() => undefined);
        paint();
      };
      if (a.readyState >= 1) restore();
      else a.addEventListener('loadedmetadata', restore, { once: true });
    } else {
      paint();
    }
  });
}
function restoreTranscriptScroll() {
  if (transcriptScrollTop <= 0) return;
  const tr = root.querySelector('[data-scroll="callTranscript"]');
  if (tr) tr.scrollTop = transcriptScrollTop;
}
function renderMain() {
  if (destroyed) return;
  snapshotCallPlayer();
  keepFocus(() => { renderNav(); renderHead(); renderContent(); });
  restoreTranscriptScroll();
  ensureCallTimer();
  bindCallPlayer();
}
function render() { if (destroyed) return; renderMain(); renderOverlay(); renderMenu(); }
function sizeComposer() {
  const t = root.querySelector('.composer textarea');
  if (!t) return;
  t.style.height = 'auto';
  t.style.height = Math.min(Math.max(t.scrollHeight + 2, 44), 180) + 'px';
}

/* =========================================================
   Data loading
   ========================================================= */
let leadsSeq = 0;
async function loadLeads() {
  const seq = ++leadsSeq;
  S.refreshing = true;
  if (S.loaded) renderMain();
  try {
    const q = S.f.q.trim();
    const data = await host.loadLeads(q);
    if (seq !== leadsSeq) return;
    S.leads = (data.leads || []).map(normLead);
    if (!q) S.total = S.leads.length;
    S.loaded = true; S.loadErr = ''; S.updatedAt = Date.now();
  } catch (e) {
    if (seq !== leadsSeq) return;
    S.loadErr = errMsg(e, 'Could not load contacts.');
    S.loaded = true;
    if (!S.leads.length && host.onError) host.onError(e);
  } finally {
    if (seq === leadsSeq) { S.refreshing = false; renderMain(); if (S.modal && S.modal.kind === 'cmdk') refreshCmd(); }
  }
}
async function loadThread(id) {
  try {
    const data = await host.loadFollowups(id);
    if (S.th.id !== id) return;
    S.th.messages = data.messages || [];
    S.th.followups = data.followups || [];
    const nd = data.pending_draft || null;
    if (S.draftEdit && (!nd || nd.id !== S.draftEdit.id)) S.draftEdit = null;
    S.th.draft = nd;
    S.th.loaded = true;
    const patch = {};
    if (data.playbook_steps) patch.playbook_steps = data.playbook_steps;
    if (data.ai_send_mode) patch.ai_send_mode = data.ai_send_mode;
    patch.pending_draft = nd;
    if (data.lead && typeof data.lead === 'object') {
      Object.assign(patch, data.lead);
    }
    mergeLead(id, patch);
    const hd = callHostData();
    if (data.callTranscript !== undefined) hd.callTranscript = data.callTranscript || null;
    if (data.callRecordingUrl !== undefined) hd.callRecordingUrl = data.callRecordingUrl || null;
    if (data.callRecordingId !== undefined) hd.callRecordingId = data.callRecordingId || null;
    if (data.activeCall) {
      hd.activeCall = data.activeCall;
      // Always sync from poll so "Connecting Ryan…" clears when transfer_status becomes connected.
      S.transferState = data.activeCall.transferState ?? null;
    } else {
      hd.activeCall = null;
      if (S.transferState) S.transferState = null;
    }
    if (data.booker_call_seconds != null) hd.bookerCallSeconds = data.booker_call_seconds;
    if (Array.isArray(data.calls)) {
      hd.calls = data.calls;
      hd.leadCallCounts = { ...(hd.leadCallCounts || {}), [id]: data.calls.length };
      mergeLead(id, { call_count: data.calls.length });
    }
    if (data.booking !== undefined) {
      hd.booking = data.booking || null;
      syncBookingFromHost(id);
      if (hd.booking && S.book.mode !== 'reschedule' && S.book.step !== 'confirm' && S.book.step !== 'pick' && S.book.step !== 'askcancel') {
        S.book = { ...S.book, leadId: id, step: 'booked' };
      }
    }
  } catch {
    if (S.th.id !== id) return;
    S.th.loaded = true;
  }
  renderMain();
}
async function loadSettings() {
  try {
    const data = await host.loadSettings();
    S.settings = data || {};
    const active = String(S.settings.active_caller_phone || '').trim();
    const callback = String(S.settings.operator_callback_phone || '').trim();
    const callers = teamCallers();
    const hit = active ? callers.find((c) => samePhone(c.phone, active)) : null;
    S.set.callerSel = hit ? String(hit.phone) : 'custom';
    S.set.opDirty = false;
    S.set.op = active || callback;
  } catch (e) {
    if (!S.settings) S.settings = null;
  }
  renderMain();
}
async function loadDocs() {
  try {
    const data = await host.loadDocs();
    S.docs = data.docs || [];
    S.docsErr = '';
  } catch (e) {
    S.docsErr = errMsg(e, 'Could not load knowledge base.');
  }
  S.docsLoaded = true;
  if (S.tab === 'knowledge') renderMain();
}

/* =========================================================
   Navigation and routing
   ========================================================= */
function setNav(id) {
  const modeMap = { crm: 'crm', ops: 'ops', clients: 'ops', properties: 'ops', team: 'ops', sops: 'ops', copilot: 'copilot', settings: 'ops', dashboard: 'ops', onboarding: 'onboarding', revenue: 'ops' };
  if (id === 'settings') { if (host.go) host.go('ops', { opsTab: 'settings' }); return; }
  if (id === 'crm') { S.leadId = null; setTab('contacts'); return; }
  if (id === 'dashboard') { if (host.go) host.go('ops', { opsTab: 'sops' }); return; }
  const m = modeMap[id];
  if (m && m !== 'crm' && host.go) {
    if (id === 'clients') { host.go('ops', { opsTab: 'clients' }); return; }
    if (id === 'properties') { host.go('ops', { opsTab: 'properties' }); return; }
    if (id === 'team') { host.go('ops', { opsTab: 'employees' }); return; }
    if (id === 'sops') { host.go('ops', { opsTab: 'sops' }); return; }
    if (id === 'revenue') { host.go('ops', { opsTab: 'month' }); return; }
    host.go(m);
  }
}
function setTab(t, opts = {}) {
  S.tab = t;
  if (t !== 'contacts') S.leadId = null;
  S.menu = null;
  if (!opts.noRoute && host.setRoute) host.setRoute({ tab: t, leadId: t === 'contacts' ? S.leadId : null });
  if (t === 'knowledge') loadDocs();
  if (t === 'settings' || t === 'welcome') loadSettings();
  render();
  const c = $('#content'); if (c) c.scrollTop = 0;
  if (window.matchMedia('(max-width:767px)').matches) window.scrollTo({ top: 0 });
}
function openLead(id, opts = {}) {
  if (!id) return;
  id = String(id);
  const same = S.leadId === id && S.tab === 'contacts';
  S.tab = 'contacts';
  S.leadId = id;
  S.menu = null;
  if (S.modal && S.modal.kind !== 'newLead') S.modal = null;
  if (!opts.noRoute && host.setRoute) host.setRoute({ tab: 'contacts', leadId: id });
  if (!same) {
    S.ptab = 'chat';
    S.rtab = 'details';
    S.sections = { book: false, profile: false, sale: false, notes: false, ai: false };
    S.phoneEdit = null;
    S.draftEdit = null;
    S.callMsg = '';
    S.callNotesEdit = false;
    S.callUi = {};
    S.transcriptOpen = false;
    transcriptScrollTop = 0;
    S.transferState = null;
    S.prof = { edit: null, q: '', hi: 0, predictions: [], searching: false, placesErr: '', draftName: '', regsLoading: false };
    S.contractStep = null;
    S.selectedTemplate = null;
    S.contractAskCancel = false;
    S.contractBusy = false;
    S.sms = ssGet(`mrg_sms_${id}`);
    S.th = { id, messages: [], followups: [], draft: null, loaded: false };
    lastMsgKey = '';
    {
      const hd = callHostData();
      hd.callTranscript = null;
      hd.callRecordingUrl = null;
      hd.callRecordingId = null;
      hd.calls = [];
      hd.booking = null;
      hd.strRules = null;
      hd.activeContract = null;
      hd.contractsUrl = null;
      hd.contractDownloadUrl = null;
      if (!hd.activeCall || String(hd.activeCall.leadId) !== id) hd.activeCall = null;
    }
    const opened = leadById(id);
    const alreadyBooked = Boolean(opened && (opened.status === 'booked' || opened.call_start_iso));
    S.book = {
      slots: [],
      dayKey: null,
      pick: null,
      loading: false,
      err: '',
      leadId: id,
      step: alreadyBooked ? 'booked' : 'pick',
      mode: 'book',
      bookingId: null,
      googleEventId: null,
      note: '',
    };
    loadThread(id).then(() => {
      if (S.leadId !== id) return;
      const l = leadById(id);
      const booked = Boolean(activeCrmBooking(l || { id }) || (l && (l.status === 'booked' || l.call_start_iso)));
      if (booked) {
        S.book = { ...S.book, leadId: id, step: S.book.mode === 'reschedule' ? S.book.step : 'booked', mode: S.book.mode === 'reschedule' ? 'reschedule' : 'book' };
        syncBookingFromHost(id);
        renderMain();
      } else {
        void loadBookSlots(id);
      }
    });
    if (host.markRead) host.markRead(id).catch(() => undefined);
    if (opened) mergeLead(id, { unread: false, sms_last_read_at: new Date().toISOString(), needs_you: opened.needs_you.filter((r) => r !== 'unanswered_inbound' && r !== 'review_ai') });
    delete S.ld[id];
  }
  render();
}

async function loadBookSlots(leadId = S.leadId, opts = {}) {
  if (!leadId || !host.loadCalendarSlots) return;
  const id = String(leadId);
  const keepMode = opts.keepMode === true;
  const keepNote = opts.keepNote === true;
  const keepDayKey = opts.keepDayKey !== false ? S.book.dayKey : null;
  S.book = {
    ...S.book,
    leadId: id,
    loading: true,
    err: '',
    pick: keepDayKey ? S.book.pick : null,
    dayKey: keepDayKey,
    step: 'pick',
    mode: keepMode ? (S.book.mode || 'book') : 'book',
    bookingId: keepMode ? S.book.bookingId : null,
    googleEventId: keepMode ? S.book.googleEventId : null,
    note: keepNote || keepMode ? (S.book.note || '') : '',
  };
  renderMain();
  try {
    const data = await host.loadCalendarSlots();
    if (S.book.leadId !== id) return;
    const slots = Array.isArray(data.slots) ? data.slots : [];
    const days = bookDaysFromSlots(slots);
    const stillValid = keepDayKey && days.some((d) => d.key === keepDayKey);
    S.book = {
      ...S.book,
      leadId: id,
      loading: false,
      err: '',
      pick: stillValid ? S.book.pick : null,
      dayKey: stillValid ? keepDayKey : (days[0] ? days[0].key : null),
      step: 'pick',
      slots,
    };
  } catch (e) {
    if (S.book.leadId !== id) return;
    S.book = {
      ...S.book,
      leadId: id,
      loading: false,
      err: errMsg(e, 'Could not load calendar times.'),
      pick: null,
      dayKey: keepDayKey,
      step: 'pick',
      slots: [],
    };
  }
  renderMain();
}

function syncBookingFromHost(leadId) {
  const hd = callHostData();
  const row = hd.booking;
  if (!row || String(row.lead_id || row.leadId) !== String(leadId)) return;
  S.book = {
    ...S.book,
    leadId: String(leadId),
    bookingId: String(row.id || '').trim() || S.book.bookingId,
    googleEventId: String(row.google_event_id || row.googleEventId || '').trim() || S.book.googleEventId,
    step: S.book.mode === 'reschedule' || S.book.step === 'askcancel' || S.book.step === 'confirm' || S.book.step === 'pick'
      ? S.book.step
      : 'booked',
  };
}

async function startReschedule(opts = {}) {
  const l = leadById(S.leadId);
  if (!l) return;
  const hd = callHostData();
  const row = hd.booking;
  const bookingId = String(opts.bookingId || (row && row.id) || S.book.bookingId || '').trim();
  const googleEventId = String(opts.googleEventId || (row && (row.google_event_id || row.googleEventId)) || S.book.googleEventId || '').trim();
  S.book = {
    ...S.book,
    leadId: String(l.id),
    mode: 'reschedule',
    step: 'pick',
    pick: null,
    dayKey: null,
    note: '',
    bookingId: bookingId || null,
    googleEventId: googleEventId || null,
  };
  S.rtab = 'details';
  await loadBookSlots(l.id, { keepMode: true });
}

async function confirmBookSlot() {
  const l = leadById(S.leadId);
  if (!l || !S.book.pick) return;
  const slot = (S.book.slots || []).find((s) => s.start === S.book.pick);
  if (!slot) return;
  const reschedule = S.book.mode === 'reschedule';
  if (reschedule) {
    if (!host.rescheduleSlot) {
      toast('Reschedule is not available.', 'bad');
      return;
    }
    if (!S.book.bookingId) {
      toast('Could not find the existing booking to reschedule.', 'bad');
      return;
    }
  } else if (!host.bookSlot) {
    return;
  }
  setBusy('book', true);
  try {
    const data = reschedule
      ? await host.rescheduleSlot({
          bookingId: S.book.bookingId,
          leadId: l.id,
          newSlot: { start: slot.start, end: slot.end },
          leadName: l.name || '',
          leadEmail: l.email || '',
          leadPhone: l.phone || '',
        })
      : await host.bookSlot({
          leadId: l.id,
          slot: { start: slot.start, end: slot.end },
          leadName: l.name || '',
          leadEmail: l.email || '',
          leadPhone: l.phone || '',
          booked_by: 'booker',
        });
    const label = data.label || slot.label;
    mergeLead(l.id, {
      status: 'booked',
      call_start_iso: slot.start,
      call_booking: label,
      booked_by: 'Booker',
      ai_paused: true,
    });
    D(l).booked = 'Booker';
    const hd = callHostData();
    hd.booking = {
      id: data.bookingId || S.book.bookingId,
      lead_id: l.id,
      slot_start: slot.start,
      slot_end: slot.end,
      google_event_id: data.eventId || S.book.googleEventId,
      label,
    };
    S.book = {
      ...S.book,
      slots: S.book.slots,
      pick: null,
      dayKey: null,
      loading: false,
      err: '',
      leadId: String(l.id),
      step: 'booked',
      mode: 'book',
      bookingId: String((hd.booking && hd.booking.id) || '').trim() || null,
      googleEventId: String((hd.booking && hd.booking.google_event_id) || '').trim() || null,
      note: reschedule ? 'Rescheduled · lead notified by text' : '',
    };
    toast(label ? (reschedule ? `Rescheduled to ${label}` : `Booked ${label}`) : (reschedule ? 'Call rescheduled' : 'Call booked'));
    await loadThread(l.id);
    loadLeads();
  } catch (e) {
    toast(errMsg(e, reschedule ? 'Could not reschedule that time.' : 'Could not book that time.'), 'bad');
  } finally {
    setBusy('book', false);
  }
}

async function cancelActiveBooking() {
  const l = leadById(S.leadId);
  if (!l || !host.cancelBooking) return;
  const hd = callHostData();
  const bookingId = String(S.book.bookingId || (hd.booking && hd.booking.id) || '').trim();
  if (!bookingId) {
    toast('Could not find the booking to cancel.', 'bad');
    return;
  }
  setBusy('book', true);
  try {
    await host.cancelBooking({
      bookingId,
      leadId: l.id,
      leadName: l.name || '',
      leadPhone: l.phone || '',
    });
    hd.booking = null;
    mergeLead(l.id, {
      status: 'engaging',
      call_start_iso: null,
      call_booking: '',
      ai_paused: false,
    });
    S.book = {
      slots: [],
      dayKey: null,
      pick: null,
      loading: false,
      err: '',
      leadId: String(l.id),
      step: 'pick',
      mode: 'book',
      bookingId: null,
      googleEventId: null,
      note: 'Booking cancelled · lead notified',
    };
    toast('Booking cancelled. Lead notified by text.');
    await loadBookSlots(l.id, { keepNote: true });
    loadLeads();
  } catch (e) {
    toast(errMsg(e, 'Could not cancel booking.'), 'bad');
  } finally {
    setBusy('book', false);
  }
}
function closeLead(opts = {}) {
  S.leadId = null;
  S.th = { id: null, messages: [], followups: [], draft: null, loaded: false };
  S.menu = null;
  S.callNotesEdit = false;
  S.callUi = {};
  S.rtab = 'details';
  S.transcriptOpen = false;
  S.transferState = null;
  const hd = callHostData();
  hd.callTranscript = null;
  hd.callRecordingUrl = null;
  hd.callRecordingId = null;
  hd.calls = [];
  hd.activeCall = null;
  if (!opts.noRoute && host.setRoute) host.setRoute({ tab: 'contacts', leadId: null });
  render();
}
function openNewLead() {
  if (S.tab !== 'contacts') setTab('contacts');
  S.nl = { name: '', phone: '', email: '', address: '', source: LEAD_SOURCES.includes('Meta ad') ? 'Meta ad' : (LEAD_SOURCES[0] || ''), referredBy: '', notes: '', err: '', busy: false };
  openModal({ kind: 'newLead' }, '#nlName');
}
function applyRoute(r) {
  if (!r) return;
  const tab = r.tab || 'contacts';
  const leadId = r.leadId ? String(r.leadId) : null;
  if (tab !== S.tab) setTab(tab, { noRoute: true });
  if (tab === 'contacts' && leadId !== S.leadId) { if (leadId) openLead(leadId, { noRoute: true }); else closeLead({ noRoute: true }); }
  if (r.newLead && !(S.modal && S.modal.kind === 'newLead')) openNewLead();
}

/* =========================================================
   Lead actions (each one is a click; nothing sends on its own)
   ========================================================= */
function applyLeadResponse(id, data) {
  if (!data) return;
  if (data.lead) mergeLead(id, data.lead);
  if (S.th.id === id) {
    if (Array.isArray(data.messages)) {
      S.th.messages = data.messages;
      const last = data.messages[data.messages.length - 1];
      if (last) mergeLead(id, { last_activity_at: last.created_at, last_sms: { body: last.body, direction: last.direction, created_at: last.created_at, meta: last.meta } });
    }
    if (Array.isArray(data.followups)) S.th.followups = data.followups;
    if ('pending_draft' in data) { S.th.draft = data.pending_draft || null; S.draftEdit = null; mergeLead(id, { pending_draft: S.th.draft }); }
  }
}
async function patchLead(body, okMsg, id = S.leadId) {
  if (!id) return null;
  setBusy('save', true);
  try {
    const data = await host.patchLead({ id, ...body });
    applyLeadResponse(id, data);
    const msg = typeof okMsg === 'function' ? okMsg(data) : okMsg;
    if (msg) toast(msg);
    return data;
  } catch (e) {
    toast(errMsg(e, 'Save failed'), 'bad');
    return null;
  } finally {
    setBusy('save', false);
  }
}
async function runSave(field, value) {
  const l = leadById(S.leadId); if (!l) return;
  const cur = { notes: l.notes, whatsNext: l.whats_next, callNotes: l.call_notes, bookedBy: l.booked_by, closedBy: l.closed_by, referredBy: l.referred_by }[field] || '';
  const v = ['bookedBy', 'closedBy', 'referredBy'].includes(field) ? value.trim() : value;
  if (v === cur) return;
  if (field === 'notes' && v === formatNotesForDisplay(cur)) return;
  const data = await patchLead({ [field]: v }, 'Saved');
  if (data && data.lead) {
    const d = D(leadById(S.leadId));
    const map = { notes: ['notes', 'notes'], whatsNext: ['whatsNext', 'whats_next'], callNotes: ['callNotes', 'call_notes'], bookedBy: ['booked', 'booked_by'], closedBy: ['closed', 'closed_by'], referredBy: ['referred', 'referred_by'] }[field];
    if (map && data.lead[map[1]] !== undefined) {
      const next = data.lead[map[1]] || '';
      d[map[0]] = field === 'notes' ? formatNotesForDisplay(next) : next;
    }
  }
}
async function sendSms() {
  const l = leadById(S.leadId); if (!l || isBusy('sms')) return;
  const text = S.sms.trim(); if (!text) return;
  if (!phoneUsable(l.phone)) { toast('Add a valid phone number for this lead first.', 'bad'); S.ptab = 'details'; S.phoneEdit = ''; renderMain(); return; }
  setBusy('sms', true);
  try {
    const data = await host.sendSms(l.id, text);
    S.sms = ''; ssSet(`mrg_sms_${l.id}`, '');
    applyLeadResponse(l.id, data);
    const now = new Date().toISOString();
    mergeLead(l.id, { ai_paused: true, unread: false, last_activity_at: (S.th.messages[S.th.messages.length - 1] || {}).created_at || now, last_sms: { body: text, direction: 'outbound', created_at: now, meta: { human: true } } });
    toast('Sent. AI paused for this lead');
  } catch (e) {
    toast(errMsg(e, 'SMS failed'), 'bad');
  } finally {
    setBusy('sms', false);
  }
}
async function draftAct(action) {
  const l = leadById(S.leadId); const d = S.th.draft;
  if (!l || !d) return;
  const body = S.draftEdit && S.draftEdit.id === d.id ? S.draftEdit.text : d.body;
  if (action === 'approve' && !body.trim()) return;
  setBusy('save', true);
  try {
    const data = await host.draftAction(l.id, action, d.id, action === 'discard' ? undefined : body);
    applyLeadResponse(l.id, data);
    if (action === 'save') S.draftEdit = null;
    toast(action === 'approve' ? 'Draft sent' : action === 'discard' ? 'Draft discarded' : 'Draft saved');
  } catch (e) {
    toast(errMsg(e, 'Could not update the draft.'), 'bad');
  } finally {
    setBusy('save', false);
  }
}
async function crmCall() {
  const l = leadById(S.leadId); if (!l || isBusy('call')) return;
  setBusy('call', true); S.callMsg = '';
  try {
    const data = await host.startCall(l.id);
    if (data.preCallSmsSent || data.preCallSmsSkipped) S.preCall[l.id] = true;
    S.callMsg = data.preCallSmsSent ? 'Texted the lead once. Now ringing your phone. Answer to connect.' : 'Ringing your phone (no new text). Answer to connect the lead.';
    S.transferState = null;
    if (data.activeCall) callHostData().activeCall = data.activeCall;
    setTimeout(() => { S.callMsg = ''; renderMain(); }, 6000);
    loadThread(l.id); loadLeads();
  } catch (e) {
    toast(errMsg(e, 'Call failed'), 'bad');
  } finally {
    setBusy('call', false);
  }
}
async function transferCall() {
  const l = leadById(S.leadId); if (!l || !host.transferCall || isBusy('call')) return;
  S.transferState = 'connecting';
  if (callHostData().activeCall) callHostData().activeCall.transferState = 'connecting';
  renderMain();
  setBusy('call', true);
  try {
    const data = await host.transferCall(l.id);
    const next = data && data.status === 'connected' ? 'connected' : 'connecting';
    S.transferState = next;
    if (callHostData().activeCall) callHostData().activeCall.transferState = next;
    toast(next === 'connected' ? 'Ryan connected' : 'Calling Ryan…');
    loadThread(l.id);
  } catch (e) {
    S.transferState = null;
    if (callHostData().activeCall) callHostData().activeCall.transferState = null;
    toast(errMsg(e, 'Transfer failed'), 'bad');
  } finally {
    setBusy('call', false);
    renderMain();
  }
}
async function cancelTransfer() {
  const l = leadById(S.leadId); if (!l) return;
  S.transferState = null;
  if (callHostData().activeCall) callHostData().activeCall.transferState = null;
  renderMain();
  if (!host.cancelTransfer) return;
  try { await host.cancelTransfer(l.id); toast('Transfer cancelled'); }
  catch (e) { toast(errMsg(e, 'Could not cancel transfer'), 'bad'); }
}
async function leaveCall() {
  const l = leadById(S.leadId); if (!l || isBusy('call')) return;
  setBusy('call', true);
  try {
    if (host.leaveCall) await host.leaveCall(l.id);
    callHostData().activeCall = null;
    S.transferState = null;
    toast('You left the call. Lead and Ryan stay connected.');
    loadThread(l.id); loadLeads();
  } catch (e) {
    toast(errMsg(e, 'Could not leave call'), 'bad');
  } finally {
    setBusy('call', false);
  }
}
async function endCall() {
  const l = leadById(S.leadId); if (!l || isBusy('call')) return;
  setBusy('call', true);
  try {
    if (host.endCall) await host.endCall(l.id);
    callHostData().activeCall = null;
    S.transferState = null;
    toast('Call ended');
    loadThread(l.id); loadLeads();
  } catch (e) {
    toast(errMsg(e, 'Could not end call'), 'bad');
  } finally {
    setBusy('call', false);
  }
}
async function markBooked(id) {
  setBusy('save', true);
  try {
    const data = await host.markBooked(id);
    applyLeadResponse(id, data);
    toast('Marked booked. Follow-up texts stopped');
  } catch (e) {
    toast(errMsg(e, 'Could not mark booked.'), 'bad');
  } finally {
    setBusy('save', false);
  }
}
async function copyText(txt, label) {
  try { await navigator.clipboard.writeText(txt); toast(`${label} copied`); } catch { toast('Could not copy', 'bad'); }
}
function askDelete(id) {
  const l = leadById(id); if (!l) return;
  openModal({ kind: 'confirm', title: `Delete ${l.name || 'this lead'}?`, lede: 'This removes the contact, its messages and notes from the CRM. It can’t be undone.', okLabel: 'Delete contact', run: async () => {
    await host.deleteLead(l.id);
    S.leads = S.leads.filter((x) => String(x.id) !== String(l.id));
    S.total = Math.max(0, S.total - 1);
    toast(`Deleted ${l.name || 'lead'}`);
    if (S.leadId === String(l.id)) closeLead();
  } });
}
function startOnboarding(l) {
  if (l.onboarding && l.onboarding.unitId) { host.openOnboardingUnit && host.openOnboardingUnit(l.onboarding.unitId); return; }
  host.startOnboarding && host.startOnboarding(l.id);
}
async function createLead() {
  const n = S.nl; if (!n || n.busy) return;
  const clean = n.name.replace(/\s+/g, ' ').trim();
  if (!clean) { n.err = 'A name is required.'; renderOverlay(); return; }
  n.busy = true; n.err = ''; renderOverlay();
  try {
    const data = await host.createLead({ createLead: true, name: clean, phone: n.phone.trim(), email: n.email.trim(), address: n.address.trim(), source: n.source, referredBy: n.source === 'Referral' ? n.referredBy.trim() : '', notes: n.notes.trim() });
    if (!data || !data.lead || !data.lead.id) throw new Error((data && data.error) || 'Could not create the lead.');
    S.modal = null; S.nl = null; renderOverlay();
    mergeLead(data.lead.id, data.lead);
    S.total += 1;
    toast(`${data.lead.name || clean} added at New · AI paused`);
    openLead(data.lead.id);
    loadLeads();
  } catch (e) {
    n.busy = false; n.err = errMsg(e, 'Could not create the lead.'); renderOverlay();
  }
}

/* ---------------- knowledge actions ---------------- */
async function kUpload(file, input) {
  if (!file) return;
  setBusy('kUp', true);
  try {
    await host.knowledgeUpload({ file, title: S.kUp.title.trim() || file.name });
    S.kUp = { title: '', text: '' };
    toast(`Uploaded ${file.name}`);
    await loadDocs();
  } catch (e) {
    S.docsErr = errMsg(e, 'Upload failed');
  } finally {
    if (input) input.value = '';
    setBusy('kUp', false);
  }
}
async function kAddPaste() {
  const text = S.kUp.text.trim();
  if (!text) { toast('Paste some text first.', 'bad'); return; }
  setBusy('kUp', true);
  try {
    await host.knowledgeUpload({ text, title: S.kUp.title.trim() });
    S.kUp = { title: '', text: '' };
    if (S.modal && S.modal.kind === 'paste') { S.modal = null; renderOverlay(); }
    toast('Text added');
    await loadDocs();
  } catch (e) {
    S.docsErr = errMsg(e, 'Could not save text');
    if (S.modal) renderOverlay();
  } finally {
    setBusy('kUp', false);
  }
}
async function kOpen(id) {
  S.ed = { id, title: '', text: '', busy: false, err: '', loading: true };
  openModal({ kind: 'editor' });
  try {
    const data = await host.loadDoc(id);
    if (S.ed.id !== id) return;
    S.ed.title = (data.doc && data.doc.title) || ''; S.ed.text = data.text || '';
  } catch (e) {
    if (S.ed.id !== id) return;
    S.ed.err = errMsg(e, 'Could not open document');
  }
  S.ed.loading = false;
  if (S.modal && S.modal.kind === 'editor') renderOverlay();
}
async function kSave() {
  const e = S.ed;
  if (!e.id || !e.text.trim()) { e.err = 'The document needs some content.'; renderOverlay(); return; }
  e.busy = true; e.err = ''; renderOverlay();
  try {
    await host.knowledgePatch({ id: e.id, action: 'save_content', title: e.title, text: e.text });
    e.busy = false; S.modal = null; renderOverlay();
    toast('Document saved');
    await loadDocs();
  } catch (err) {
    e.busy = false; e.err = errMsg(err, 'Could not save document'); renderOverlay();
  }
}
async function kToggle(id) {
  const d = S.docs.find((x) => String(x.id) === String(id)); if (!d) return;
  d.active = !d.active; renderMain();
  try { await host.knowledgePatch({ id: d.id, active: d.active }); await loadDocs(); }
  catch (e) { d.active = !d.active; toast(errMsg(e, 'Could not update document'), 'bad'); renderMain(); }
}
async function kRetry(id) {
  setBusy('kUp', true);
  try { await host.knowledgePatch({ id, action: 'reindex' }); await loadDocs(); toast('Processing again'); }
  catch (e) { S.docsErr = errMsg(e, 'Reindex failed'); }
  finally { setBusy('kUp', false); }
}
function kDelete(id) {
  const d = S.docs.find((x) => String(x.id) === String(id)); if (!d) return;
  openModal({ kind: 'confirm', title: `Delete ${d.title || 'this document'}?`, lede: 'The AI stops using it right away. It can’t be undone.', okLabel: 'Delete', run: async () => {
    await host.knowledgeDelete(d.id);
    toast('Document deleted');
    await loadDocs();
  } });
}

/* ---------------- welcome templates ---------------- */
function openWelcomeTpl(id) {
  const t = id ? welcomeTemplates().find((x) => String(x.id) === String(id)) : null;
  S.wm = {
    id: t ? t.id : null,
    name: t ? t.name : '',
    trigger: t ? (t.trigger || '') : '',
    message: t ? (t.message || '') : '',
    nameErr: '',
    trigErr: '',
    askDel: null,
  };
  openModal({ kind: 'welcomeTpl' }, '#wmName');
}
async function persistWelcomeTemplates(next, okMsg) {
  setBusy('welcome', true);
  try {
    if (host.act) await host.act('save_welcome_templates', { templates: next });
    else await host.patchSettings({ action: 'save_welcome_templates', templates: next });
    await loadSettings();
    S.wm.askDel = null;
    toast(okMsg || 'Template saved');
  } catch (e) {
    toast(errMsg(e, 'Could not save welcome templates'), 'bad');
  } finally {
    setBusy('welcome', false);
  }
}
async function saveWelcomeTpl() {
  const w = S.wm;
  if (!String(w.name || '').trim()) {
    w.nameErr = 'Add a template name.';
    renderOverlay();
    const el = root.querySelector('#wmName');
    if (el) el.focus();
    return;
  }
  const blankTrig = !String(w.trigger || '').trim();
  const otherDefault = welcomeTemplates().find((t) => (t.is_default || !String(t.trigger || '').trim()) && String(t.id) !== String(w.id || ''));
  if (blankTrig && otherDefault) {
    renderOverlay();
    const el = root.querySelector('#wmTrig');
    if (el) el.focus();
    return;
  }
  const id = w.id || newTplId();
  const row = {
    id,
    name: String(w.name).trim(),
    trigger: String(w.trigger || '').trim(),
    message: String(w.message || ''),
    is_default: blankTrig,
  };
  let next = welcomeTemplates().filter((t) => String(t.id) !== String(id));
  if (row.is_default) next = next.map((t) => ({ ...t, is_default: false }));
  next.push(row);
  S.modal = null;
  renderOverlay();
  await persistWelcomeTemplates(next, w.id ? 'Template saved' : 'Template added');
}
async function deleteWelcomeTpl(id) {
  const cur = welcomeTemplates().find((t) => String(t.id) === String(id));
  if (!cur) return;
  if (cur.is_default || !String(cur.trigger || '').trim()) {
    toast('The default template can’t be deleted', 'bad');
    return;
  }
  const next = welcomeTemplates().filter((t) => String(t.id) !== String(id));
  await persistWelcomeTemplates(next, `${cur.name} deleted`);
}

/* ---------------- settings actions ---------------- */
async function patchSettings(body, busyKey, okMsg) {
  setBusy(busyKey, true);
  try {
    const data = await host.patchSettings(body);
    S.settings = { ...(S.settings || {}), ...(data || {}) };
    if (okMsg) toast(okMsg);
    return data;
  } catch (e) {
    toast(errMsg(e, 'Save failed'), 'bad');
    return null;
  } finally {
    setBusy(busyKey, false);
  }
}
async function saveCallerPhone(phone, busyKey = 'op') {
  setBusy(busyKey, true);
  S.set.opMsg = '';
  try {
    const data = await host.act('saveCrmSettings', { active_caller_phone: String(phone || '').trim() });
    S.settings = { ...(S.settings || {}), ...(data || {}) };
    const saved = String(data.active_caller_phone ?? phone ?? '').trim();
    S.settings.active_caller_phone = saved;
    const callers = teamCallers();
    const hit = saved ? callers.find((c) => samePhone(c.phone, saved)) : null;
    S.set.callerSel = hit ? String(hit.phone) : 'custom';
    S.set.op = saved || callbackPhone();
    S.set.opDirty = false;
    S.set.opMsg = 'Saved';
    setTimeout(() => { S.set.opMsg = ''; if (S.tab === 'settings') renderMain(); }, 1600);
    renderMain();
    return data;
  } catch (e) {
    toast(errMsg(e, 'Could not save caller phone'), 'bad');
    return null;
  } finally {
    setBusy(busyKey, false);
  }
}
async function saveOp() {
  const phone =
    S.set.callerSel === 'custom' || S.set.callerSel == null
      ? S.set.op.trim()
      : String(S.set.callerSel || '').trim();
  return saveCallerPhone(phone, 'op');
}
function selectRingFirst(v) {
  if (v === '__custom__') {
    S.set.callerSel = 'custom';
    if (S.settings) S.settings.active_caller_phone = '';
    S.set.opDirty = true;
    if (!S.set.op.trim()) S.set.op = callbackPhone();
    renderMain();
    const t = root.querySelector('#opPhone');
    if (t) t.focus();
    return;
  }
  S.set.callerSel = v;
  if (S.settings) S.settings.active_caller_phone = v;
  S.set.op = v;
  S.set.opDirty = true;
  S.set.opMsg = '';
  renderMain();
}
async function notifyAdd(name, phone) {
  const data = await patchSettings({ action: 'add_notify_recipient', name, phone }, 'notify');
  if (data) { S.set.nName = ''; S.set.nPhone = ''; S.set.nMsg = data.welcome_sent ? 'Saved. Welcome text sent' : 'Saved'; renderMain(); }
}
async function createCode() {
  const data = await patchSettings({ action: 'create_unlock_code', code: S.set.uCode.trim(), label: S.set.uLabel.trim() }, 'unlock');
  if (data) { S.set.uMsg = `Created ${(data.code && data.code.code) || S.set.uCode.trim().toUpperCase()}. One-time use.`; S.set.uCode = ''; S.set.uLabel = ''; renderMain(); }
}
async function pastePreview() {
  setBusy('paste', true); S.set.pErr = ''; S.set.pMsg = '';
  try { S.set.preview = await host.previewPaste(S.set.paste); }
  catch (e) { S.set.preview = null; S.set.pErr = errMsg(e, 'Preview failed'); }
  finally { setBusy('paste', false); }
}
async function pasteImport() {
  setBusy('paste', true); S.set.pErr = ''; S.set.pMsg = '';
  try {
    const data = await host.importPaste(S.set.paste);
    const smsNote = (data.smsSentNow || 0) > 0
      ? (data.aiSkipped ? ` Safe intro SMS sent (AI issue logged on lead: ${data.aiSkipped}).` : ' AI first SMS sent.')
      : (data.decision && data.decision.qualifiesForBookEmail ? ` No customer SMS (${data.aiSkipped || 'AI off or Twilio missing'}).` : ' No SMS.');
    S.set.pMsg = `Saved ${(data.parsed && data.parsed.name) || 'lead'} as ${STATUS_LABEL[data.decision && data.decision.status] || (data.decision && data.decision.status) || 'New'}.${smsNote}`;
    S.set.paste = ''; S.set.preview = null;
    await loadLeads();
    if (data.leadId) openLead(data.leadId);
  } catch (e) {
    S.set.pErr = errMsg(e, 'Import failed');
  } finally {
    setBusy('paste', false);
  }
}

/* ---------------- Ctrl+K ---------------- */
function openCmdk() { S.cmd = { q: '', act: 0, items: [] }; openModal({ kind: 'cmdk' }, '[data-k="cmd.q"]'); }
function refreshCmd() { const r = $('#cmdRes'); if (r) r.innerHTML = cmdResults(); }
function runCmd(i) {
  const it = S.cmd.items[i]; if (!it) return;
  S.modal = null; renderOverlay();
  if (it.kind === 'lead') openLead(it.l.id);
  else if (it.a === 'newLead') openNewLead();
  else if (it.a === 'go:ops:settings') { if (host.go) host.go('ops', { opsTab: 'settings' }); }
  else if (it.a.startsWith('tab:')) setTab(it.a.slice(4));
}

/* =========================================================
   Events
   ========================================================= */
function setPath(path, value) {
  const [a, b] = path.split('.');
  if (a === 'ld') { const l = leadById(S.leadId); if (l) D(l)[b] = value; return; }
  if (a === 'draftEdit') { if (S.draftEdit) S.draftEdit.text = value; return; }
  if (!b) { S[a] = value; return; }
  if (S[a]) S[a][b] = value;
}
const ACT = {
  sideTog: () => { root.classList.toggle('sb-collapsed'); lsSet('crm-sb', root.classList.contains('sb-collapsed') ? '1' : '0'); },
  newLead: () => openNewLead(),
  goSettings: () => setTab('settings'),
  closeModal: () => closeModal(),
  confirmOk: async () => {
    const m = S.modal; if (!m || m.busy) return;
    m.busy = true; renderOverlay();
    try { await m.run(); S.modal = null; renderOverlay(); render(); }
    catch (e) { m.busy = false; renderOverlay(); toast(errMsg(e, 'Delete failed'), 'bad'); }
  },
  needs: (b) => { S.f.needs = b.dataset.v === '1'; renderMain(); },
  bookedWeek: () => { S.f.booked = !S.f.booked; renderMain(); if (S.modal && S.modal.kind === 'filters') renderOverlay(); },
  fset: (b) => { S.f[b.dataset.f] = b.dataset.v; renderMain(); renderOverlay(); },
  filters: () => openModal({ kind: 'filters' }),
  clearFilters: () => {
    const hadQ = S.f.q.trim();
    S.f = { q: '', needs: false, path: 'all', stage: 'all', ai: 'all', booked: false, sort: 'inbox' };
    if (S.modal && S.modal.kind === 'filters') { S.modal = null; renderOverlay(); }
    renderMain(); if (hadQ) loadLeads();
  },
  showAll: () => { S.f.needs = false; renderMain(); },
  refresh: () => { loadLeads(); if (S.leadId) loadThread(S.leadId); },
  open: (b) => openLead(b.dataset.id),
  rowMenu: (b) => { if (S.menu && S.menu.id === b.dataset.id && S.menu.kind === 'row') { S.menu = null; renderMenu(); return; } openMenu('row', b.dataset.id, b); },
  leadMenu: (b) => { if (S.menu && S.menu.kind === 'lead') { S.menu = null; renderMenu(); return; } openMenu('lead', S.leadId, b); },
  closeLead: () => closeLead(),
  ptab: (b) => {
    S.ptab = b.dataset.v;
    if (S.ptab === 'details' || S.ptab === 'calls') S.rtab = S.ptab;
    renderMain();
  },
  rtab: (b) => {
    S.rtab = b.dataset.v === 'calls' ? 'calls' : 'details';
    if (S.rtab === 'calls') S.ptab = 'calls';
    else if (S.ptab === 'calls') S.ptab = 'details';
    renderMain();
  },
  toggleSection: (b) => {
    const key = b.dataset.key;
    if (!key) return;
    S.sections[key] = !S.sections[key];
    renderMain();
  },
  toggleCallCard: (b) => {
    const id = b.dataset.id;
    if (!id) return;
    const ui = callUiState(id);
    ui.open = !ui.open;
    if (!ui.open) { ui.edit = false; ui.tr = false; }
    renderMain();
  },
  dialCall: () => {
    const l = leadById(S.leadId);
    const tel = l && phoneUsable(l.phone) ? telHref(l.phone) : null;
    if (tel) window.location.href = tel;
  },
  toggleCallTranscript: (b) => {
    const id = b.dataset.id;
    if (!id) return;
    const ui = callUiState(id);
    ui.tr = !ui.tr;
    renderMain();
  },
  editCallSummary: (b) => {
    const id = b.dataset.id;
    if (!id) return;
    const call = leadCallsAsc().find((c) => String(c.id) === String(id));
    const ui = callUiState(id);
    ui.edit = true;
    ui.draft = call ? String(call.summary || '') : '';
    ui.open = true;
    renderMain();
    const ta = root.querySelector(`[data-call-sumta="${CSS.escape(id)}"]`);
    if (ta) ta.focus();
  },
  cancelCallSummary: (b) => {
    const id = b.dataset.id;
    if (!id) return;
    const ui = callUiState(id);
    ui.edit = false;
    ui.draft = null;
    renderMain();
  },
  saveCallSummary: async (b) => {
    const id = b.dataset.id;
    if (!id || !S.leadId) return;
    const ta = root.querySelector(`[data-call-sumta="${CSS.escape(id)}"]`);
    const summary = ta ? ta.value : '';
    try {
      setBusy('save', true);
      const data = await host.patchLead({
        id: S.leadId,
        updateCallSummary: true,
        callId: id,
        summary,
      });
      const hd = callHostData();
      if (Array.isArray(data.calls)) {
        hd.calls = data.calls;
        hd.leadCallCounts = { ...(hd.leadCallCounts || {}), [S.leadId]: data.calls.length };
      } else {
        hd.calls = (hd.calls || []).map((c) =>
          String(c.id) === String(id) ? { ...c, summary } : c,
        );
      }
      const ui = callUiState(id);
      ui.edit = false;
      ui.draft = null;
      toast('Summary saved');
    } catch (e) {
      toast(errMsg(e, 'Could not save summary'), 'bad');
    } finally {
      setBusy('save', false);
      renderMain();
    }
  },
  toggleCallPlay: (b) => {
    const id = b.dataset.id;
    if (!id) return;
    const a = root.querySelector(`[data-call-audio="${CSS.escape(id)}"]`);
    if (!a) return;
    root.querySelectorAll('[data-call-audio]').forEach((el) => {
      if (el !== a && !el.paused) el.pause();
    });
    if (a.paused) a.play().catch(() => toast('Could not play recording', 'bad'));
    else a.pause();
  },
  seekCallAudio: (b, e) => {
    const id = b.dataset.id;
    if (!id) return;
    const a = root.querySelector(`[data-call-audio="${CSS.escape(id)}"]`);
    if (!a || !a.duration) return;
    const r = b.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    a.currentTime = ratio * a.duration;
  },
  aiTakeOver: () => patchLead({ aiPaused: true }, 'AI paused for this chat'),
  aiResume: () => patchLead({ aiPaused: false }, 'AI resumed'),
  aiEnable: () => patchLead({ aiForceOn: true }, 'AI on for this lead'),
  sendMode: (b) => { const l = leadById(S.leadId); if (!l || l.ai_send_mode === b.dataset.v) return; mergeLead(l.id, { ai_send_mode: b.dataset.v }); patchLead({ aiSendMode: b.dataset.v }, b.dataset.v === 'draft' ? 'AI drafts for review' : 'Autopilot on'); },
  aiFirst: () => { const l = leadById(S.leadId); if (!l) return; setBusy('save', true);
    host.aiSendFirst(l.id).then((data) => { applyLeadResponse(l.id, data); toast(data && data.pending_draft ? 'AI first message drafted' : 'AI first message sent'); })
      .catch((e) => toast(errMsg(e, 'AI did not send the first SMS.'), 'bad')).finally(() => setBusy('save', false)); },
  followUp: () => { const l = leadById(S.leadId); if (!l) return; setBusy('save', true);
    host.aiNudge(l.id).then((data) => { applyLeadResponse(l.id, data); toast(data && data.pending_draft ? 'Follow-up drafted' : 'Follow-up sent'); })
      .catch((e) => toast(errMsg(e, 'Could not follow up.'), 'bad')).finally(() => setBusy('save', false)); },
  fupDone: () => { const last = S.th.messages[S.th.messages.length - 1]; if (last) S.fupDone[last.id || last.created_at] = true; renderMain(); },
  draftApprove: () => draftAct('approve'),
  draftDiscard: () => draftAct('discard'),
  draftSave: () => draftAct('save'),
  draftEdit: () => { if (S.th.draft) { S.draftEdit = { id: S.th.draft.id, text: S.th.draft.body }; renderMain(); const t = root.querySelector('[data-k="draftEdit.text"]'); if (t) t.focus(); } },
  draftCancel: () => { S.draftEdit = null; renderMain(); },
  sendSms: () => sendSms(),
  editPhone: () => { const l = leadById(S.leadId); S.phoneEdit = l && phoneUsable(l.phone) ? fmtPhone(l.phone) : ''; S.ptab = 'details'; renderMain(); const t = root.querySelector('[data-k="phoneEdit"]'); if (t) t.focus(); },
  cancelPhone: () => { S.phoneEdit = null; renderMain(); },
  savePhone: async () => { const v = String(S.phoneEdit || '').trim(); if (!v) { toast('Enter a phone number.', 'bad'); return; } const data = await patchLead({ phone: v }, 'Phone saved'); if (data) { S.phoneEdit = null; renderMain(); } },
  profEdit: (b) => {
    const field = b.dataset.v;
    const l = leadById(S.leadId);
    if (!l) return;
    if (field === 'addr') {
      S.prof = { ...S.prof, edit: 'addr', q: String(l.property_address || '').split(',')[0] || '', hi: 0, predictions: [] };
    } else if (field === 'name') {
      S.prof = { ...S.prof, edit: 'name', draftName: String(l.full_name || '') };
    }
    renderMain();
    const sel = field === 'addr' ? '[data-k="prof.q"]' : '[data-k="prof.draftName"]';
    const t = root.querySelector(sel);
    if (t) t.focus();
  },
  profCancel: () => { S.prof = { ...S.prof, edit: null, q: '', predictions: [], draftName: '' }; renderMain(); },
  profSaveName: async () => {
    const name = String(S.prof.draftName || '').trim();
    const ok = await saveProfile({ full_name: name });
    if (ok) { S.prof = { ...S.prof, edit: null, draftName: '' }; renderMain(); }
  },
  profPickPlace: async (b) => {
    const placeId = String(b.dataset.placeId || '').trim();
    const desc = String(b.dataset.desc || '').trim();
    let address = desc;
    let city = '';
    let pid = placeId;
    if (placeId && host.placesDetails) {
      try {
        const place = await host.placesDetails(placeId);
        if (place && place.formatted_address) address = place.formatted_address;
        if (place && place.city) city = String(place.city).trim();
      } catch { /* keep autocomplete description */ }
    }
    if (!city && address) {
      const parts = address.split(',').map((x) => x.trim()).filter(Boolean);
      if (parts.length > 1) city = parts[1];
    }
    const fields = {
      property_address: address,
      property_place_id: pid,
      property_city: city,
    };
    const ok = await saveProfile(fields);
    if (ok) {
      S.prof = { ...S.prof, edit: null, q: '', predictions: [] };
      const hd = callHostData();
      hd.strRules = null;
      mergeLead(S.leadId, { str_rules_checked_at: null, str_rules_city: '' });
      renderMain();
    }
  },
  profOwnership: async (b) => {
    const v = b.dataset.v;
    const l = leadById(S.leadId);
    if (!l || l.ownership === v) return;
    await saveProfile({ ownership: v });
  },
  profAirbnb: async (b) => {
    const v = b.dataset.v;
    const live = v === 'live';
    const l = leadById(S.leadId);
    const cur = l && l.airbnb_live === true ? 'live' : l && l.airbnb_live === false ? 'not' : '';
    if (cur === v) return;
    const fields = { airbnb_live: live };
    if (live) fields.permit_status = '';
    await saveProfile(fields);
  },
  profFurnished: async (b) => {
    const v = b.dataset.v;
    const l = leadById(S.leadId);
    if (!l || l.furnished === v) return;
    await saveProfile({ furnished: v });
  },
  profOccupants: async (b) => {
    const v = b.dataset.v;
    const l = leadById(S.leadId);
    if (!l || l.occupants === v) return;
    const fields = { occupants: v };
    if (v === 'vacant') fields.occupant_notes = '';
    await saveProfile(fields);
  },
  profCheckRegs: async () => {
    const l = leadById(S.leadId);
    if (!l || !host.checkStrRules) return;
    if (!String(l.property_city || '').trim() && !String(l.property_address || '').trim()) {
      toast('Add a property address first.', 'bad');
      return;
    }
    S.prof.regsLoading = true;
    renderMain();
    try {
      const data = await host.checkStrRules(l.id);
      const hd = callHostData();
      hd.strRules = { ...data, leadId: l.id };
      const checkedAt = data.checkedAt || new Date().toISOString();
      mergeLead(l.id, {
        str_rules_checked_at: checkedAt,
        str_rules_city: data.city || l.property_city || '',
      });
      toast(data.notFound ? 'No rules on file for that city' : 'STR rules loaded');
    } catch (e) {
      toast(errMsg(e, 'Could not check STR rules'), 'bad');
    } finally {
      S.prof.regsLoading = false;
      renderMain();
    }
  },
  copyPhone: (b) => { const l = leadById(b.dataset.id || S.leadId); if (l && l.phone) copyText(fmtPhone(l.phone), 'Phone'); S.menu = null; renderMenu(); },
  crmCall: () => crmCall(),
  transferCall: () => transferCall(),
  cancelTransfer: () => cancelTransfer(),
  leaveCall: () => leaveCall(),
  endCall: () => endCall(),
  editCallNotes: () => { S.callNotesEdit = true; renderMain(); const t = root.querySelector('#sumTa'); if (t) t.focus(); },
  cancelCallNotesEdit: () => {
    const l = leadById(S.leadId);
    if (l) D(l).callNotes = l.call_notes || '';
    S.callNotesEdit = false;
    renderMain();
  },
  saveCallNotes: async () => {
    const l = leadById(S.leadId); if (!l) return;
    const ta = root.querySelector('#sumTa');
    const v = ta ? ta.value : D(l).callNotes;
    D(l).callNotes = v;
    await runSave('callNotes', v);
    S.callNotesEdit = false;
    renderMain();
  },
  toggleTranscript: () => { S.transcriptOpen = !S.transcriptOpen; renderMain(); },
  togglePlay: () => {
    const a = root.querySelector('#callAudio');
    if (!a) return;
    if (a.paused) a.play().catch(() => toast('Could not play recording', 'bad'));
    else a.pause();
  },
  seekAudio: (b, e) => {
    const a = root.querySelector('#callAudio');
    if (!a || !a.duration) return;
    const r = b.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    a.currentTime = ratio * a.duration;
  },
  saveNotes: () => { const l = leadById(S.leadId); if (l) runSave('notes', D(l).notes); },
  pbComplete: () => patchLead({ playbookAction: 'complete' }, 'Step completed').then(() => undefined),
  pbSkip: () => patchLead({ playbookAction: 'skip' }, 'Step skipped').then(() => undefined),
  startOnboarding: () => { const l = leadById(S.leadId); if (l) startOnboarding(l); },
  openUnit: (b) => { const l = leadById(b.dataset.id || S.leadId); if (l && l.onboarding) host.openOnboardingUnit && host.openOnboardingUnit(l.onboarding.unitId); },
  convertClient: (b) => { const l = leadById(b.dataset.id || S.leadId); S.menu = null; renderMenu(); if (l && host.convertLeadToOpsClient) host.convertLeadToOpsClient({ id: l.id, name: l.name, email: l.email, phone: l.phone }); },
  openContractPick: async () => {
    const l = leadById(S.leadId);
    if (!l) return;
    if (!String(l.email || '').trim()) {
      toast('Add an email on this lead before sending a contract.', 'bad');
      return;
    }
    S.contractBusy = true;
    renderMain();
    try {
      if (host.loadContractTemplates) await host.loadContractTemplates();
      S.contractStep = 'picker';
      S.selectedTemplate = null;
      S.contractAskCancel = false;
    } catch (e) {
      toast(errMsg(e, 'Could not load contract templates.'), 'bad');
    } finally {
      S.contractBusy = false;
      renderMain();
    }
  },
  cancelContractPick: () => {
    S.contractStep = null;
    S.selectedTemplate = null;
    renderMain();
  },
  pickContractTemplate: (b) => {
    const id = b.dataset.id;
    const hd = callHostData();
    const t = (hd.templates || []).find((row) => String(row.id) === String(id));
    if (!t) return;
    S.selectedTemplate = t;
    S.contractStep = 'review';
    renderMain();
  },
  backContractPick: () => {
    S.contractStep = 'picker';
    renderMain();
  },
  confirmSendContract: async () => {
    const l = leadById(S.leadId);
    const t = S.selectedTemplate;
    if (!l || !t || !host.sendContract) return;
    S.contractBusy = true;
    renderMain();
    try {
      const data = await host.sendContract(l.id, t.id);
      S.contractStep = null;
      S.selectedTemplate = null;
      S.contractAskCancel = false;
      if (data && data.contract) {
        const hd = callHostData();
        hd.activeContract = data.contract;
        if (data.contracts_url) hd.contractsUrl = data.contracts_url;
      }
      mergeLead(l.id, { contract_status: 'sent', contract_id: data && data.contract ? data.contract.id : l.contract_id });
      toast(`Contract sent to ${l.email || 'lead'}`);
      if (host.loadActiveContract) await host.loadActiveContract(l.id);
      await loadThread(l.id);
    } catch (e) {
      toast(errMsg(e, 'Could not send contract.'), 'bad');
    } finally {
      S.contractBusy = false;
      renderMain();
    }
  },
  askCancelContract: () => { S.contractAskCancel = true; renderMain(); },
  keepContract: () => { S.contractAskCancel = false; renderMain(); },
  doCancelContract: async () => {
    const l = leadById(S.leadId);
    if (!l || !host.cancelContract) return;
    S.contractBusy = true;
    renderMain();
    try {
      await host.cancelContract(l.id);
      S.contractAskCancel = false;
      S.contractStep = null;
      mergeLead(l.id, { contract_status: 'cancelled' });
      toast('Contract cancelled');
      if (host.loadActiveContract) await host.loadActiveContract(l.id);
    } catch (e) {
      toast(errMsg(e, 'Could not cancel contract.'), 'bad');
    } finally {
      S.contractBusy = false;
      renderMain();
    }
  },
  reloadBookSlots: () => {
    if (S.book.step === 'booked' || S.book.step === 'askcancel') {
      void loadThread(S.leadId);
      return;
    }
    void loadBookSlots(S.leadId, { keepMode: S.book.mode === 'reschedule', keepNote: Boolean(S.book.note) });
  },
  bookDay: (b) => {
    const dayKey = b.getAttribute('data-day-key') || b.dataset.dayKey || b.dataset.day || null;
    S.book = { ...S.book, dayKey, pick: null, step: 'pick' };
    renderMain();
    const on = root.querySelector(`.days .dpill.on`);
    if (on) {
      on.focus({ preventScroll: true });
      if (typeof on.scrollIntoView === 'function') {
        on.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'instant' });
      }
    }
  },
  bookShowConfirm: () => {
    if (!S.book.pick) return;
    S.book = { ...S.book, step: 'confirm' };
    renderMain();
  },
  cancelBookConfirm: () => {
    S.book = { ...S.book, step: 'pick' };
    renderMain();
  },
  confirmBookSlot: () => { void confirmBookSlot(); },
  bookAskCancel: () => {
    S.book = { ...S.book, step: 'askcancel', mode: 'book' };
    renderMain();
  },
  bookDoCancel: () => { void cancelActiveBooking(); },
  bookKeepCurrent: () => {
    S.book = { ...S.book, step: 'booked', mode: 'book', pick: null, dayKey: null, note: S.book.note || '' };
    renderMain();
  },
  rescheduleBooking: (b) => {
    void startReschedule({
      bookingId: b.dataset.bookingId || '',
      googleEventId: b.dataset.eventId || '',
    });
  },
  askDelete: (b) => askDelete(b.dataset.id || S.leadId),
  kEdit: (b) => kOpen(b.dataset.id),
  kAddPaste: () => kAddPaste(),
  kPasteSheet: () => openModal({ kind: 'paste' }, '#psT'),
  kToggle: (b) => kToggle(b.dataset.id),
  kRetry: (b) => kRetry(b.dataset.id),
  kDelete: (b) => kDelete(b.dataset.id),
  edSave: () => kSave(),
  toggleAuto: () => patchSettings({ ai_responses_enabled: !(S.settings && S.settings.ai_responses_enabled) }, 'globalAi', null),
  saveOp: () => saveOp(),
  notifyToggle: () => patchSettings({ lead_notify_sms_enabled: !(S.settings && S.settings.lead_notify_sms_enabled) }, 'notify', 'Saved'),
  notifyAdd: () => notifyAdd(S.set.nName, S.set.nPhone),
  notifyVerify: (b) => { S.set.nPhone = b.dataset.phone || ''; S.set.nName = b.dataset.name || ''; S.set.nMsg = 'Add a name, then press Add person to verify.'; renderMain(); const t = root.querySelector('[data-k="set.nName"]'); if (t) t.focus(); },
  notifyRemove: (b) => patchSettings({ action: 'remove_notify_recipient', id: b.dataset.id }, 'notify', 'Removed'),
  createCode: () => createCode(),
  copyCode: (b) => copyText(b.dataset.code, 'Code'),
  pastePreview: () => pastePreview(),
  pasteImport: () => pasteImport(),
  wmNew: () => openWelcomeTpl(null),
  wmEdit: (b) => openWelcomeTpl(b.dataset.id),
  wmDel: (b) => { S.wm.askDel = b.dataset.id; renderMain(); },
  wmKeep: () => { S.wm.askDel = null; renderMain(); },
  wmDelYes: (b) => deleteWelcomeTpl(b.dataset.id),
  logout: () => { if (host.logout) Promise.resolve(host.logout()).catch((e) => toast(errMsg(e, 'Log out failed'), 'bad')); },
};

function onClick(e) {
  const t = e.target;
  if (S.menu && !t.closest('.menu') && !t.closest('[data-act="rowMenu"],[data-act="leadMenu"]')) { S.menu = null; renderMenu(); }
  const ci = t.closest('[data-ci]'); if (ci) { runCmd(+ci.dataset.ci); return; }
  const nav = t.closest('[data-nav]'); if (nav) { setNav(nav.dataset.nav); return; }
  const tab = t.closest('[data-tab]'); if (tab) { setTab(tab.dataset.tab); return; }
  if (t.closest('[data-cmdk]')) { openCmdk(); return; }
  const a = t.closest('[data-act]');
  if (a) { if (a.disabled) return; const fn = ACT[a.dataset.act]; if (fn) { e.preventDefault(); fn(a, e); } return; }
  const row = t.closest('[data-open]');
  if (row) openLead(row.dataset.open);
}
function onInput(e) {
  const t = e.target, k = t.dataset && t.dataset.k;
  if (!k) return;
  if (k === 'prof.q') { void searchPlaces(t.value); return; }
  if (k === 'prof.draftName') { S.prof.draftName = t.value; return; }
  if (k === 'prof.occNote') return;
  setPath(k, t.value);
  if (k === 'f.q') { clearTimeout(qT); qT = setTimeout(() => loadLeads(), 250); return; }
  if (k === 'sms') {
    ssSet(`mrg_sms_${S.leadId}`, t.value);
    const b = root.querySelector('.sendbtn'); const l = leadById(S.leadId);
    if (b) b.classList.toggle('off', !(t.value.trim() && l && phoneUsable(l.phone)));
    sizeComposer();
    return;
  }
  if (k === 'nl.name' || k === 'nl.phone') {
    const h = nlHints();
    const hn = root.querySelector('[data-hint="name"]'), hp = root.querySelector('[data-hint="phone"]');
    if (hn) { hn.innerHTML = h.name; hn.className = `hint ${h.nameCls}`; }
    if (hp) { hp.innerHTML = h.phone; hp.className = `hint ${h.phoneCls}`; }
    const sv = root.querySelector('#nlSave'); if (sv) sv.disabled = Boolean(S.nl.busy) || !S.nl.name.trim();
    return;
  }
  if (k === 'cmd.q') { S.cmd.act = 0; refreshCmd(); return; }
  if (k === 'set.op') { S.set.opDirty = true; const b = root.querySelector('[data-act="saveOp"]'); if (b) b.disabled = isBusy('op'); return; }
  if (k === 'set.paste') { root.querySelectorAll('[data-act="pastePreview"],[data-act="pasteImport"]').forEach((b) => { b.disabled = isBusy('paste') || !t.value.trim(); }); return; }
  if (k === 'set.nPhone') { const b = root.querySelector('[data-act="notifyAdd"]'); if (b) b.disabled = isBusy('notify') || !t.value.trim(); return; }
  if (k === 'set.uCode') { const b = root.querySelector('[data-act="createCode"]'); if (b) b.disabled = isBusy('unlock') || t.value.trim().length < 4; return; }
  if (k === 'wm.name' || k === 'wm.trigger' || k === 'wm.message') {
    if (k === 'wm.name') S.wm.nameErr = '';
    if (S.modal && S.modal.kind === 'welcomeTpl') keepFocus(() => renderOverlay());
    return;
  }
  if (k === 'ld.booked' || k === 'ld.closed') t.classList.toggle('ph', !t.value.trim());
}
function onChange(e) {
  const t = e.target;
  if (t.dataset.sel) {
    const k = t.dataset.sel, v = t.value;
    if (k.startsWith('f.')) { S.f[k.slice(2)] = v; renderMain(); if (S.modal && S.modal.kind === 'filters') renderOverlay(); return; }
    if (k === 'nl.source') { S.nl.source = v; keepFocus(renderOverlay); return; }
    if (k === 'ringFirst') { selectRingFirst(v); return; }
    if (k === 'bookTime') {
      S.book = { ...S.book, pick: v || null, step: 'pick' };
      renderMain();
      return;
    }
    const l = leadById(S.leadId); if (!l) return;
    if (k === 'status') patchLead({ status: v }, `Stage set to ${STATUS_LABEL[v] || v}`);
    else if (k === 'offerPath') patchLead({ offerPath: v }, `Path set to ${OFFER_PATH_LABEL[v] || v}`);
    else if (k === 'plan') patchLead({ plan: v }, 'Plan saved');
    else if (k === 'contractStatus') patchLead({ contractStatus: v }, 'Contract saved');
    else if (k === 'profPermit') void saveProfile({ permit_status: v });
    return;
  }
  if (t.dataset.save) { runSave(t.dataset.save, t.value); return; }
  if (t.dataset && t.dataset.saveProf === 'occupant_notes') {
    void saveProfile({ occupant_notes: t.value });
    return;
  }
  if (t.dataset.file) { const f = t.files && t.files[0]; if (f) kUpload(f, t); }
}
function onKey(e) {
  const t = e.target;
  if (e.key === 'Escape') {
    if (S.menu) { S.menu = null; renderMenu(); return; }
    if (S.modal) { closeModal(); return; }
    if (S.phoneEdit != null) { S.phoneEdit = null; renderMain(); return; }
    if (S.prof.edit) { S.prof = { ...S.prof, edit: null, q: '', predictions: [], draftName: '' }; renderMain(); return; }
  }
  if (t.dataset && t.dataset.k === 'prof.q') {
    const preds = Array.isArray(S.prof.predictions) ? S.prof.predictions : [];
    if (e.key === 'ArrowDown') { e.preventDefault(); S.prof.hi = Math.min(preds.length - 1, S.prof.hi + 1); renderMain(); const inp = root.querySelector('[data-k="prof.q"]'); if (inp) inp.focus(); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); S.prof.hi = Math.max(0, S.prof.hi - 1); renderMain(); const inp = root.querySelector('[data-k="prof.q"]'); if (inp) inp.focus(); return; }
    if (e.key === 'Enter' && preds[S.prof.hi] && S.prof.q.length > 1) {
      e.preventDefault();
      const x = preds[S.prof.hi];
      ACT.profPickPlace({ dataset: { placeId: x.place_id || '', desc: x.description || '' } });
      return;
    }
  }
  if (t.dataset && t.dataset.k === 'prof.draftName' && e.key === 'Enter') { e.preventDefault(); ACT.profSaveName(); return; }
  if (t.dataset && t.dataset.k === 'cmd.q') {
    const n = S.cmd.items.length;
    if (e.key === 'ArrowDown') { e.preventDefault(); S.cmd.act = n ? (S.cmd.act + 1) % n : 0; refreshCmd(); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); S.cmd.act = n ? (S.cmd.act - 1 + n) % n : 0; refreshCmd(); return; }
    if (e.key === 'Enter') { e.preventDefault(); runCmd(S.cmd.act); return; }
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && S.th.draft && S.leadId && !isBusy('save')) { e.preventDefault(); draftAct('approve'); return; }
  if (t.dataset && t.dataset.k === 'sms' && e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); sendSms(); return; }
  if (t.dataset && t.dataset.k === 'phoneEdit' && e.key === 'Enter') { e.preventDefault(); ACT.savePhone(); return; }
  if (e.key === 'Enter' && t.matches && t.matches('[data-open]')) { e.preventDefault(); openLead(t.dataset.open); }
}
function onSubmit(e) {
  if (e.target.id === 'nlForm') { e.preventDefault(); createLead(); return; }
  if (e.target.id === 'wmForm') { e.preventDefault(); saveWelcomeTpl(); }
}
function onScrimDown(e) { if (e.target.id === 'scrim') closeModal(); }
function onDocKey(e) {
  if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) { if (!root.isConnected || !root.getClientRects().length) return; e.preventDefault(); if (S.modal && S.modal.kind === 'cmdk') closeModal(); else openCmdk(); }
}
function onResize() { if (S.menu) { S.menu = null; renderMenu(); } }

let qT = 0;
root.addEventListener('click', onClick);
root.addEventListener('input', onInput);
root.addEventListener('change', onChange);
root.addEventListener('keydown', onKey);
root.addEventListener('submit', onSubmit);
root.addEventListener('mousedown', onScrimDown);
document.addEventListener('keydown', onDocKey);
window.addEventListener('resize', onResize);

/* =========================================================
   Start: route, first load, live poll every 12s
   ========================================================= */
const r0 = (host.getRoute && host.getRoute()) || {};
S.tab = r0.tab || 'contacts';
render();
loadLeads();
loadSettings();
if (S.tab === 'knowledge') loadDocs();
if (S.tab === 'contacts' && r0.leadId) openLead(r0.leadId, { noRoute: true });
if (r0.newLead) openNewLead();

const poll = setInterval(() => {
  if (document.hidden) return;
  const a = shadow.activeElement;
  if (a && a.tagName === 'SELECT') return;
  loadLeads();
  if (S.leadId) loadThread(S.leadId);
  if (S.tab === 'knowledge') loadDocs();
}, 12000);
const tick = setInterval(() => { if (S.tab === 'contacts' && !S.leadId && !S.refreshing) { const m = root.querySelector('.listhead .lhr .meta'); if (m) m.textContent = updatedLabel(); } }, 30000);

return {
  destroy() {
    destroyed = true;
    clearInterval(poll); clearInterval(tick); clearTimeout(qT); clearTimeout(toastT); clearTimeout(placesT);
    if (callTick) { clearInterval(callTick); callTick = null; }
    document.removeEventListener('keydown', onDocKey);
    window.removeEventListener('resize', onResize);
    root.innerHTML = '';
  },
  openLead: (id) => openLead(id),
  openNewLead: () => openNewLead(),
  applyRoute,
};
}
