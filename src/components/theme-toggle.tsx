"use client";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
export function ThemeToggle(){const[theme,setTheme]=useState<"dark"|"light">("dark");useEffect(()=>setTheme(document.documentElement.dataset.theme==="light"?"light":"dark"),[]);function toggle(){const next=theme==="dark"?"light":"dark";document.documentElement.dataset.theme=next;localStorage.setItem("ccx-theme",next);setTheme(next)}return <button type="button" onClick={toggle} className="grid size-9 place-items-center rounded-md border border-line bg-surface text-muted hover:border-brand hover:text-foreground" aria-label={theme==="dark"?"ღია თემაზე გადასვლა":"მუქ თემაზე გადასვლა"}>{theme==="dark"?<Sun size={16}/>:<Moon size={16}/>}</button>}
