"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import experiments from "../../../experiments.json";

export function Header() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="fixed top-4 left-4 z-50">
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white/80 backdrop-blur-sm hover:bg-white transition-colors outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-300"
        >
          Menu
        </button>
        
        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 -z-10"
              onClick={() => setIsOpen(false)}
            />
            
            {/* Dropdown */}
            <div className="absolute left-0 mt-2 min-w-[180px] rounded-md border border-gray-200 bg-white shadow-lg">
              {experiments.map((experiment) => {
                const isActive = pathname === experiment.url;
                return (
                  <Link
                    key={experiment.url}
                    href={experiment.url}
                    onClick={() => setIsOpen(false)}
                    className={`block px-3 py-2 text-sm hover:bg-gray-100 transition-colors ${
                      isActive ? "font-medium bg-gray-50" : ""
                    }`}
                  >
                    {experiment.name}
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </div>
    </header>
  );
}

