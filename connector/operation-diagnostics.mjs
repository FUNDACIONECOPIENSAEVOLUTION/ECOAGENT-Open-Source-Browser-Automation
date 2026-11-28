// Exact allowlist: do not return exception text, paths, URLs or credentials.
const codes=new Map([
 ['Attachment selection failed','attachment_selection_failed'],['Attachment browser digest failed','attachment_browser_digest_failed'],['Stale reference','stale_reference'],
 ['Approval pending','approval_pending'],['Approval denied','approval_denied'],['Approval unavailable','approval_unavailable'],['Approval mismatched','approval_mismatched'],['Approval dependency expired','approval_dependency_expired'],
 ['Document unavailable','document_unavailable'],['Document missing or expired','document_unavailable'],['Attachment input occupied','attachment_occupied'],['Input unavailable, single-file only or already populated','attachment_input_unavailable'],['Input does not accept multiple documents','attachment_multiple_unsupported'],['Attachment verification failed','attachment_verification_failed'],['Attachment mismatch','attachment_verification_failed'],
 ['Unknown live session','session_unavailable'],['Independent browser session limit reached','session_limit'],['Authentication screen; manual access required','authentication_required'],['Static draft required','draft_required'],['Draft mode required','draft_required'],['Local UI disabled','local_ui_disabled'],['Form changed','stale_reference'],['Link changed','stale_reference'],['Control changed','stale_reference']
]);
export function operationDiagnostic(error){const message=error?.message;const code=codes.get(message)||'operation_failed';return {error:code,requiresReview:true,automaticRetry:false};}
