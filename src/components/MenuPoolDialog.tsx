import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Plus } from 'lucide-react';
import { MenuItem } from '../types/menu';
import { bindModernDialog, closeTopLayer } from '../engine/dialogCompat';

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
    const seen = new Set<string>();
    const list: string[] = [ALL_CATEGORY];
    menus.forEach((m) => {
      if (m.category && !seen.has(m.category)) {
        seen.add(m.category);
        list.push(m.category);
      }
    });
    return list;
  }, [menus]);

  const filteredMenus = useMemo(() => {
    if (activeCategory === ALL_CATEGORY) return menus;
    return menus.filter((m) => m.category === activeCategory);
  }, [menus, activeCategory]);

  const allFilteredEnabled =
    filteredMenus.length > 0 && filteredMenus.every((m) => m.enabled);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = newMenuName.trim();
    if (!cleaned) return;
    onAddMenu(cleaned);
    setNewMenuName('');
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

  return (
    <dialog
      ref={dialogRef}
      className="paper-dialog"
      aria-labelledby="pool-dialog-title"
      {...({ closedby: 'any' } as React.DialogHTMLAttributes<HTMLDialogElement>)}
    >
      <div className="dialog-header">
        <h2 id="pool-dialog-title" className="dialog-title">
          메뉴 후보 ({activeCount})
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

        <div className="menu-cat-bar">
          <div className="menu-cat-tabs" role="group" aria-label="카테고리 필터">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                className="menu-cat-pill"
                aria-pressed={activeCategory === cat}
                onClick={() => setActiveCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
          {activeCategory !== ALL_CATEGORY && (
            <button type="button" className="menu-cat-action" onClick={handleBulkToggle}>
              {allFilteredEnabled ? '이 분류 끄기' : '이 분류 켜기'}
            </button>
          )}
        </div>

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
      </div>

      <div className="dialog-footer">
        <button
          type="button"
          className="text-btn"
          style={{ marginRight: 'auto' }}
          onClick={() => {
            setActiveCategory(ALL_CATEGORY);
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
