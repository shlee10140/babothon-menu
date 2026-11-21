import React, { useEffect, useRef, useState } from 'react';
import { X, Download, Check, Link2 } from 'lucide-react';
import { ProofResult } from '../types/menu';
import { bindModernDialog, closeTopLayer } from '../engine/dialogCompat';
import { renderProofCertificatePng } from '../engine/certificateCanvas';
import { copyTextWithFallback } from '../engine/shareUrl';

interface CertificateDialogProps {
  open: boolean;
  proof: ProofResult;
  shareUrl: string;
  onClose: () => void;
  onNotify: (msg: string) => void;
}

export const CertificateDialog: React.FC<CertificateDialogProps> = ({
  open,
  proof,
  shareUrl,
  onClose,
  onNotify,
}) => {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [dataUrl, setDataUrl] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  const copiedTimerRef = useRef<number | null>(null);

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
    if (open) {
      setDataUrl(renderProofCertificatePng(proof));
      setLinkCopied(false);
      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open) {
      void closeTopLayer(dialog);
    }
  }, [open, proof]);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current);
    };
  }, []);

  const handleDownload = () => {
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.download = `난진짜다좋아_${proof.menu.name}.png`;
    link.href = dataUrl;
    link.click();
    onNotify('이미지를 저장했어요.');
  };

  const handleCopyLink = async () => {
    const ok = await copyTextWithFallback(shareUrl);
    if (ok) {
      setLinkCopied(true);
      if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = window.setTimeout(() => setLinkCopied(false), 2000);
      onNotify('결과 링크를 복사했어요.');
    } else {
      onNotify('링크 복사에 실패했어요.');
    }
  };

  const handleClose = () => {
    void closeTopLayer(dialogRef.current);
  };

  return (
    <dialog
      ref={dialogRef}
      className="paper-dialog"
      aria-labelledby="cert-dialog-title"
      {...({ closedby: 'any' } as React.DialogHTMLAttributes<HTMLDialogElement>)}
    >
      <div className="dialog-header">
        <h2 id="cert-dialog-title" className="dialog-title">
          결과 공유하기
        </h2>
        <button type="button" className="icon-btn" onClick={handleClose} aria-label="닫기">
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="dialog-body">
        <div className="cert-stage">
          {dataUrl && (
            <img src={dataUrl} alt={`${proof.menu.name} 결과 카드`} className="cert-img" />
          )}
        </div>
      </div>

      <div className="dialog-footer dialog-footer--share">
        <button type="button" className="btn btn--sm" onClick={handleCopyLink}>
          {linkCopied ? (
            <Check size={15} aria-hidden="true" />
          ) : (
            <Link2 size={15} aria-hidden="true" />
          )}
          <span>{linkCopied ? '복사됨' : '링크 복사'}</span>
        </button>
        <button type="button" className="btn btn--primary btn--sm" autoFocus onClick={handleDownload}>
          <Download size={15} aria-hidden="true" />
          <span>이미지 저장</span>
        </button>
      </div>
    </dialog>
  );
};
