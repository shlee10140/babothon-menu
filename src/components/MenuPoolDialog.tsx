import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Plus, Search } from 'lucide-react';
import { MenuItem } from '../types/menu';
import { bindModernDialog, closeTopLayer } from '../engine/dialogCompat';
import { matchesMenuQuery } from '../engine/menuCatalog';

interface MenuPoolDialogProps {
  open: boolean;
  menus: MenuItem[];
  onClose: () => void;
  onToggleMenu: (id: string) => void;
  onSetMenusEnabled: (ids: string[], enabled: boolean) => void;
  onAddMenu: (name: string) => void;
  onResetMenus: () => void;
}

const ALL_CATEGORY = '전체';

export const MenuPoolDialog: React.FC<MenuPoolDialogProps> = ({
  open,
  menus,
  onClose,
  onToggleMenu,
  onSetMenusEnabled,
  onAddMenu,
  onResetMenus,
}) => {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [newMenuName, setNewMenuName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>(ALL_CATEGORY);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    return bindModernDialog(dialog, () => {
      onClose();
    });
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      void closeTopLayer(dialog);
    }
  }, [open]);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    const order: string[] = [];
    menus.forEach((m) => {
      if (m.category) {
        if (!counts.has(m.category)) order.push(m.category);
        counts.set(m.category, (counts.get(m.category) ?? 0) + 1);
      }
    });
    return [
      { name: ALL_CATEGORY, count: menus.length },
      ...order.map((name) => ({ name, count: counts.get(name) ?? 0 })),
    ];
  }, [menus]);

  const filteredMenus = useMemo(() => {
    return menus.filter((m) => {
      if (activeCategory !== ALL_CATEGORY && m.category !== activeCategory) return false;
      return matchesMenuQuery(m.name, searchQuery);
    });
  }, [menus, activeCategory, searchQuery]);

  const allFilteredEnabled =
    filteredMenus.length > 0 && filteredMenus.every((m) => m.enabled);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = newMenuName.trim();
    if (!cleaned) return;
    onAddMenu(cleaned);
    setNewMenuName('');
    setSearchQuery('');
    setActiveCategory(ALL_CATEGORY);
  };

  const handleBulkToggle = () => {
    const ids = filteredMenus.map((m) => m.id);
    onSetMenusEnabled(ids, !allFilteredEnabled);
  };

  const handleClose = () => {
    void closeTopLayer(dialogRef.current);
  };

  const activeCount = menus.filter((m) => m.enabled).length;
  const isFiltered = activeCategory !== ALL_CATEGORY || searchQuery.trim().length > 0;

  return (
    <dialog
      ref={dialogRef}
      className="paper-dialog"
      aria-labelledby="pool-dialog-title"
      {...({ closedby: 'any' } as React.DialogHTMLAttributes<HTMLDialogElement>)}
    >
      <div className="dialog-header">
        <h2 id="pool-dialog-title" className="dialog-title">
          메뉴 후보 ({activeCount}/{menus.length})
        </h2>
        <button type="button" className="icon-btn" onClick={handleClose} aria-label="닫기">
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="dialog-body">
        <form className="menu-add-row" onSubmit={handleAdd}>
          <label htmlFor="custom-menu-input" className="sr-only">
            먹고 싶은 메뉴 추가
          </label>
          <input
            id="custom-menu-input"
            type="text"
            maxLength={14}
            className="clean-input"
            placeholder="먹고 싶은 메뉴 직접 추가"
            value={newMenuName}
            onChange={(e) => setNewMenuName(e.target.value)}
          />
          <button type="submit" className="btn btn--primary btn--sm">
            <Plus size={15} aria-hidden="true" />
            <span>추가</span>
          </button>
        </form>

        <div className="menu-search-wrap">
          <Search size={15} className="menu-search-icon" aria-hidden="true" />
          <label htmlFor="menu-search-input" className="sr-only">
            메뉴 이름 또는 초성 검색
          </label>
          <input
            id="menu-search-input"
            type="search"
            maxLength={20}
            className="clean-input menu-search-input"
            placeholder="메뉴 검색"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="menu-search-clear"
              onClick={() => setSearchQuery('')}
              aria-label="검색어 지우기"
            >
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="menu-cat-bar">
          <div className="menu-cat-tabs" role="group" aria-label="카테고리 필터">
            {categories.map((cat) => (
              <button
                key={cat.name}
                type="button"
                className="menu-cat-pill"
                aria-pressed={activeCategory === cat.name}
                onClick={() => setActiveCategory(cat.name)}
              >
                <span>{cat.name}</span>
                <span className="menu-cat-count">{cat.count}</span>
              </button>
            ))}
          </div>
          {isFiltered && filteredMenus.length > 0 && (
            <div className="menu-cat-meta">
              <span className="menu-cat-summary">표시 {filteredMenus.length}개</span>
              <button type="button" className="menu-cat-action" onClick={handleBulkToggle}>
                {allFilteredEnabled
                  ? searchQuery.trim()
                    ? '검색 결과 끄기'
                    : '이 분류 끄기'
                  : searchQuery.trim()
                  ? '검색 결과 켜기'
                  : '이 분류 켜기'}
              </button>
            </div>
          )}
        </div>

        {filteredMenus.length > 0 ? (
          <div className="menu-grid" role="group" aria-label="메뉴 후보 선택">
            {filteredMenus.map((m) => (
              <button
                key={m.id}
                type="button"
                className="menu-chip"
                aria-pressed={m.enabled}
                onClick={() => onToggleMenu(m.id)}
              >
                <span>{m.name}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="menu-empty-hint">
            ‘{searchQuery.trim()}’에 맞는 메뉴가 없어요. 위에서 직접 추가할 수 있어요.
          </p>
        )}
      </div>

      <div className="dialog-footer">
        <button
          type="button"
          className="text-btn"
          style={{ marginRight: 'auto' }}
          onClick={() => {
            setActiveCategory(ALL_CATEGORY);
            setSearchQuery('');
            onResetMenus();
          }}
        >
          초기화
        </button>
        <button type="button" className="btn btn--primary btn--sm" autoFocus onClick={handleClose}>
          완료
        </button>
      </div>
    </dialog>
  );
};
