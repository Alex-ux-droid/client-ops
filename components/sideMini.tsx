"use client";
import { useEffect, useState } from "react";
import Icon from "./Icon";

// Згорнута бокова панель (тільки значки) — клас side-mini на <html>, памʼятається в браузері.
// Початковий клас ставить скрипт у layout ще до малювання, щоб панель не «стрибала».
export function SideToggle() {
  const [mini, setMini] = useState(false);
  useEffect(() => setMini(document.documentElement.classList.contains("side-mini")), []);
  const toggle = () => {
    const next = !document.documentElement.classList.contains("side-mini");
    document.documentElement.classList.toggle("side-mini", next);
    try { localStorage.setItem("side-mini", next ? "1" : "0"); } catch {}
    setMini(next);
  };
  return (
    <button type="button" className="side-toggle" onClick={toggle} title={mini ? "Розгорнути панель" : "Згорнути панель"} aria-label={mini ? "Розгорнути панель" : "Згорнути панель"}>
      <Icon name={mini ? "sideOpen" : "sideClose"} size={18} />
      <span className="lbl">Згорнути</span>
    </button>
  );
}

export const SIDE_MINI_SCRIPT = "try{if(localStorage.getItem('side-mini')==='1')document.documentElement.classList.add('side-mini')}catch(e){}";
