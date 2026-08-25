"use client";

import { useId, useRef, useState, useTransition } from "react";
import { submitFeedbackAction, type FeedbackActionState } from "@/lib/actions/feedback";
import { clearSubmissionKeyState, keyForSubmission, transitionSubmissionKeyState, type CanonicalFeedbackPayload, type SubmissionKeyState } from "@/lib/feedback/submission-key-state";
import styles from "./feedback-dialog.module.css";

const initialState: FeedbackActionState = { error: null, fieldErrors: {}, success: false };

export function FeedbackDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const titleId = useId();
  const [pathname, setPathname] = useState<string | null>(null);
  const [type, setType] = useState<"bug" | "suggestion" | null>(null);
  const [message, setMessage] = useState("");
  const [allowFollowUp, setAllowFollowUp] = useState(false);
  const [state, setState] = useState(initialState);
  const [submissionState, setSubmissionState] = useState<SubmissionKeyState>(null);
  const [pending, startTransition] = useTransition();

  function open() {
    setPathname(window.location.pathname);
    setSubmissionState(clearSubmissionKeyState());
    dialogRef.current?.showModal();
    requestAnimationFrame(() => messageRef.current?.focus());
  }
  const typeErrorId = state.fieldErrors.type ? "feedback-type-error" : undefined;
  const preparationError = state.fieldErrors.submissionKey;
  const formError = preparationError ?? state.error;
  function clearDialogState() {
    setType(null); setMessage(""); setAllowFollowUp(false); setPathname(null);
    setSubmissionState(clearSubmissionKeyState()); setState(initialState);
  }
  function close() { dialogRef.current?.close(); }
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submittedPayload: CanonicalFeedbackPayload = { type, message, pathname, allowFollowUp };
    const submittedSubmissionState = keyForSubmission(submissionState, submittedPayload);
    const formData = new FormData(event.currentTarget);
    formData.set("submissionKey", submittedSubmissionState.key);
    setSubmissionState(submittedSubmissionState);
    startTransition(async () => {
      const result = await submitFeedbackAction(initialState, formData);
      setState(result);
      if (result.success) {
        setType(null); setMessage(""); setAllowFollowUp(false); setPathname(null);
        setSubmissionState(clearSubmissionKeyState());
      }
      else if (result.retrySubmissionKey) setSubmissionState(transitionSubmissionKeyState(submittedSubmissionState, submittedPayload, "ambiguous", result.retrySubmissionKey));
      else if (Object.keys(result.fieldErrors).length > 0) setSubmissionState(transitionSubmissionKeyState(submittedSubmissionState, submittedPayload, "validation"));
      else setSubmissionState(transitionSubmissionKeyState(submittedSubmissionState, submittedPayload, "rejected"));
    });
  }

  return <>
    <button className={styles.launcher} type="button" onClick={open}>Enviar feedback</button>
    <dialog
      className={styles.dialog}
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(event) => { if (pending) event.preventDefault(); }}
      onClose={clearDialogState}
    >
      <form onSubmit={submit} className={styles.form} aria-busy={pending}>
        <h2 id={titleId}>Enviar feedback</h2>
        <p className={styles.warning}>Não inclua senhas, dados bancários, credenciais ou outras informações sensíveis.</p>
        <fieldset className={styles.types} aria-describedby={["feedback-guidance", typeErrorId].filter(Boolean).join(" ") || undefined} aria-invalid={Boolean(typeErrorId)}>
          <legend>Sobre o que é seu feedback?</legend>
          <label><input name="type" type="radio" value="bug" required checked={type === "bug"} onChange={() => setType("bug")} /> Problema</label>
          <label><input name="type" type="radio" value="suggestion" checked={type === "suggestion"} onChange={() => setType("suggestion")} /> Sugestão</label>
        </fieldset>
        {state.fieldErrors.type && <p id={typeErrorId} className={styles.error} role="alert">{state.fieldErrors.type}</p>}
        <p id="feedback-guidance" className={styles.guidance}>{type === "suggestion" ? "Conte o que você gostaria que melhorasse." : "Para um problema, conte o que aconteceu e o que você esperava que acontecesse."}</p>
        <label htmlFor="feedback-message">Mensagem</label>
        <textarea ref={messageRef} id="feedback-message" name="message" value={message} onChange={(event) => setMessage(event.target.value)} required maxLength={5000} aria-invalid={Boolean(state.fieldErrors.message)} aria-describedby={state.fieldErrors.message ? "feedback-message-error" : undefined} />
        {state.fieldErrors.message && <p id="feedback-message-error" className={styles.error} role="alert">{state.fieldErrors.message}</p>}
        <label className={styles.followUp}><input name="allowFollowUp" type="checkbox" value="on" checked={allowFollowUp} onChange={(event) => setAllowFollowUp(event.target.checked)} /> Aceito contato para acompanhamento deste feedback.</label>
        <input name="pathname" type="hidden" value={pathname ?? ""} />
        <input name="submissionKey" type="hidden" value={submissionState?.key ?? ""} />
        {formError && <p className={styles.error} role="alert">{formError}</p>}
        {state.success && <p className={styles.success} role="status">Feedback enviado. Obrigado!</p>}
        <div className={styles.actions}><button type="button" onClick={close} disabled={pending}>Cancelar</button><button type="submit" disabled={pending}>{pending ? "Enviando…" : "Enviar feedback"}</button></div>
      </form>
    </dialog>
  </>;
}
