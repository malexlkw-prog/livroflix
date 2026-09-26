import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  User as UserIcon,
  ShieldCheck,
  ChevronDown,
} from 'lucide-react';
import { ActiveView, PlatformSettings, UserProfile } from '../types';
import { LivroflixLogo } from './LivroflixLogo';

interface HeaderProps {
  activeView: ActiveView;
  selectedCategory: string | null;
  onNavigate: (view: ActiveView) => void;
  onSelectCategory: (category: string) => void;
  userProfile: UserProfile | null;
  isAdmin: boolean;
  downloadsCount: number;
  myListCount: number;
  categoriesList?: string[];
  platformSettings?: PlatformSettings;
}

export const BOOK_CATEGORIES_LIST = [
  'Em alta',
  'Clássicos',
  'Fantasia',
  'Romance',
  'Mistério',
  'Terror',
  'Ficção',
  'Literatura brasileira',
  'Literatura mundial',
  'Para aprender',
  'Filosofia',
  'História',
  'Biografia',
  'Ciência',
];

export const Header: React.FC<HeaderProps> = ({
  activeView,
  selectedCategory,
  onNavigate,
  onSelectCategory,
  userProfile,
  isAdmin,
  downloadsCount,
  myListCount,
  categoriesList = BOOK_CATEGORIES_LIST,
  platformSettings,
}) => {
  const navHomeText = platformSettings?.navHomeText || 'Início';
  const navMyListText = platformSettings?.navMyListText || 'Minha lista';
  const navDownloadsText = platformSettings?.navDownloadsText || 'Downloads';
  const navCategoriesText = platformSettings?.navCategoriesText || 'Categorias';
  const showDownloadsTab = platformSettings?.showDownloadsTab !== false;
  const showCategoriesTab = platformSettings?.showCategoriesTab !== false;
  const showSearchButton = platformSettings?.showSearchButton !== false;
  const [scrolled, setScrolled] = useState(false);
  const [catDropdownOpen, setCatDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setCatDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header
      ref={dropdownRef}
      className={`fixed top-0 inset-x-0 z-40 transition-all duration-300 ${
        scrolled || activeView !== 'home' || catDropdownOpen
          ? 'bg-[#040D1A]/95 backdrop-blur-xl border-b border-blue-400/15 py-3 shadow-[0_10px_30px_rgba(2,8,23,0.85)]'
          : 'bg-gradient-to-b from-[#040D1A]/95 via-[#040D1A]/65 to-transparent py-3.5 sm:py-4'
      }`}
    >
      <div className="mx-auto max-w-[1440px] px-4 sm:px-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2.5 lg:gap-4">
        {/* Top Row: Logo + Desktop Nav + Right Actions */}
        <div className="flex items-center justify-between gap-4 w-full">
          {/* Left: Official Livroflix Logo + Top Tabs */}
          <div className="flex items-center gap-7 xl:gap-9">
            <button
              type="button"
              onClick={() => {
                setCatDropdownOpen(false);
                onNavigate('home');
              }}
              className="flex items-center text-left group focus:outline-none cursor-pointer transition-transform hover:scale-[1.02]"
            >
              <LivroflixLogo
                size="md"
                variant="dark-bg"
                logoImageUrl={platformSettings?.logoImageUrl}
                logoText={platformSettings?.logoText}
              />
            </button>

            {/* Desktop Top Navigation Tabs: Início | Minha lista | Downloads | Categorias */}
            <nav className="hidden lg:flex items-center gap-6">
              <button
                type="button"
                onClick={() => {
                  setCatDropdownOpen(false);
                  onNavigate('home');
                }}
                className={`text-sm font-medium transition-colors cursor-pointer ${
                  activeView === 'home' && !catDropdownOpen
                    ? 'text-[#60A5FA] font-bold'
                    : 'text-blue-100/80 hover:text-white'
                }`}
              >
                {navHomeText}
              </button>

              <button
                type="button"
                onClick={() => {
                  setCatDropdownOpen(false);
                  onNavigate('minha-lista');
                }}
                className={`text-sm font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                  activeView === 'minha-lista' && !catDropdownOpen
                    ? 'text-[#60A5FA] font-bold'
                    : 'text-blue-100/80 hover:text-white'
                }`}
              >
                <span>{navMyListText}</span>
                {myListCount > 0 && (
                  <span className="rounded-full bg-blue-500/20 border border-blue-400/40 px-1.5 py-0.2 text-[10px] font-bold text-blue-300">
                    {myListCount}
                  </span>
                )}
              </button>

              {showDownloadsTab && (
                <button
                  type="button"
                  onClick={() => {
                    setCatDropdownOpen(false);
                    onNavigate('downloads');
                  }}
                  className={`text-sm font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                    activeView === 'downloads' && !catDropdownOpen
                      ? 'text-[#60A5FA] font-bold'
                      : 'text-blue-100/80 hover:text-white'
                  }`}
                >
                  <span>{navDownloadsText}</span>
                  {downloadsCount > 0 && (
                    <span className="rounded-full bg-blue-500/20 border border-blue-400/40 px-1.5 py-0.2 text-[10px] font-bold text-blue-300">
                      {downloadsCount}
                    </span>
                  )}
                </button>
              )}

              {/* Categorias — Opens the Category Selection Box first */}
              {showCategoriesTab && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setCatDropdownOpen((prev) => !prev)}
                    className={`text-sm font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                      activeView === 'categorias' || catDropdownOpen
                        ? 'text-[#60A5FA] font-bold'
                        : 'text-blue-100/80 hover:text-white'
                    }`}
                  >
                    <span>{navCategoriesText}</span>
                    <ChevronDown
                      className={`w-4 h-4 transition-transform duration-200 ${
                        catDropdownOpen ? 'rotate-180 text-[#60A5FA]' : ''
                      }`}
                    />
                  </button>
                </div>
              )}

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setCatDropdownOpen(false);
                    onNavigate('admin');
                  }}
                  className={`text-sm font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                    activeView === 'admin'
                      ? 'text-[#60A5FA] font-semibold'
                      : 'text-blue-300/80 hover:text-[#60A5FA]'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Admin</span>
                </button>
              )}
            </nav>
          </div>

          {/* Right: Search Icon & User Profile */}
          <div className="flex items-center gap-2.5 sm:gap-4">
            {showSearchButton && (
              <button
                type="button"
                onClick={() => {
                  setCatDropdownOpen(false);
                  onNavigate('pesquisa');
                }}
                aria-label="Pesquisar"
                title="Pesquisar livros, autores e personagens"
                className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors cursor-pointer ${
                  activeView === 'pesquisa'
                    ? 'bg-[#2563EB] text-white shadow-[0_0_15px_rgba(37,99,235,0.5)]'
                    : 'text-blue-100 hover:text-white hover:bg-blue-500/15'
                }`}
              >
                <Search className="w-4 h-4 stroke-[2.2]" />
              </button>
            )}

            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  setCatDropdownOpen(false);
                  onNavigate('admin');
                }}
                title="Painel Administrativo"
                className="lg:hidden flex h-8 w-8 items-center justify-center rounded-full border border-blue-400/40 bg-blue-500/15 text-blue-300"
              >
                <ShieldCheck className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setCatDropdownOpen(false);
                onNavigate('perfil');
              }}
              className={`flex items-center gap-2 rounded-full py-1.5 px-3 transition-colors cursor-pointer border ${
                activeView === 'perfil'
                  ? 'bg-blue-600/25 border-blue-400/50 text-white'
                  : 'border-blue-400/15 bg-blue-950/50 text-blue-100 hover:text-white hover:bg-blue-900/50'
              }`}
            >
              <UserIcon className="w-4 h-4 text-[#60A5FA]" />
              <span className="hidden md:inline text-xs sm:text-sm font-semibold text-white max-w-[140px] truncate">
                {userProfile ? userProfile.nome : 'Marcos Leandro'}
              </span>
            </button>
          </div>
        </div>

        {/* Mobile/Tablet Top Navigation Row: Início | Minha lista | Downloads | Categorias */}
        <nav className="flex lg:hidden items-center gap-4 sm:gap-6 overflow-x-auto no-scrollbar border-t border-blue-400/10 pt-2 pb-0.5 text-xs sm:text-sm">
          <button
            type="button"
            onClick={() => {
              setCatDropdownOpen(false);
              onNavigate('home');
            }}
            className={`whitespace-nowrap font-medium transition-colors cursor-pointer ${
              activeView === 'home' && !catDropdownOpen
                ? 'text-[#60A5FA] font-bold'
                : 'text-blue-200/80'
            }`}
          >
            {navHomeText}
          </button>

          <button
            type="button"
            onClick={() => {
              setCatDropdownOpen(false);
              onNavigate('minha-lista');
            }}
            className={`whitespace-nowrap font-medium transition-colors flex items-center gap-1 cursor-pointer ${
              activeView === 'minha-lista' && !catDropdownOpen
                ? 'text-[#60A5FA] font-bold'
                : 'text-blue-200/80'
            }`}
          >
            <span>{navMyListText}</span>
            {myListCount > 0 && (
              <span className="rounded-full bg-blue-500/25 px-1.5 text-[10px] font-bold text-blue-300">
                {myListCount}
              </span>
            )}
          </button>

          {showDownloadsTab && (
            <button
              type="button"
              onClick={() => {
                setCatDropdownOpen(false);
                onNavigate('downloads');
              }}
              className={`whitespace-nowrap font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                activeView === 'downloads' && !catDropdownOpen
                  ? 'text-[#60A5FA] font-bold'
                  : 'text-blue-200/80'
              }`}
            >
              <span>{navDownloadsText}</span>
              {downloadsCount > 0 && (
                <span className="rounded-full bg-blue-500/25 px-1.5 text-[10px] font-bold text-blue-300">
                  {downloadsCount}
                </span>
              )}
            </button>
          )}

          {showCategoriesTab && (
            <button
              type="button"
              onClick={() => setCatDropdownOpen((prev) => !prev)}
              className={`whitespace-nowrap font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                activeView === 'categorias' || catDropdownOpen
                  ? 'text-[#60A5FA] font-bold'
                  : 'text-blue-200/80'
              }`}
            >
              <span>{navCategoriesText}</span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  catDropdownOpen ? 'rotate-180 text-[#60A5FA]' : ''
                }`}
              />
            </button>
          )}
        </nav>

        {/* CAIXA DE CATEGORIAS DE LIVROS */}
        {catDropdownOpen && (
          <div className="w-full lg:w-[560px] lg:absolute lg:left-64 lg:top-16 rounded-2xl bg-[#071426]/98 border border-blue-400/25 p-4 sm:p-5 shadow-[0_25px_60px_rgba(2,6,23,0.95)] backdrop-blur-2xl z-50 mt-1 lg:mt-0">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-blue-400/15">
              <span className="text-xs font-extrabold uppercase tracking-wider text-[#60A5FA]">
                Escolha uma categoria de livros
              </span>
              <button
                type="button"
                onClick={() => setCatDropdownOpen(false)}
                className="text-xs text-blue-200/70 hover:text-white cursor-pointer"
              >
                Fechar
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {categoriesList.map((category) => {
                const isSelected =
                  activeView === 'categorias' && selectedCategory === category;
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => {
                      setCatDropdownOpen(false);
                      onSelectCategory(category);
                    }}
                    className={`rounded-xl px-3.5 py-2.5 text-left text-xs sm:text-sm font-semibold transition-all cursor-pointer truncate ${
                      isSelected
                        ? 'bg-[#2563EB] text-white shadow-md'
                        : 'bg-blue-950/50 hover:bg-blue-600/25 text-blue-100 hover:text-white border border-blue-400/10 hover:border-blue-400/40'
                    }`}
                  >
                    {category}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
