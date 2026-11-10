-- Record the actual pinned engine attempted by the on-device client. Reviewed templates are explicitly labelled in their body.
alter table public.nova_worker_drafts alter column model_id set default 'onnx-community/Qwen2.5-0.5B-Instruct';
alter table public.nova_worker_drafts alter column model_revision set default '22942cb7d7ba4cc81bb4673549ca4d4614469b5e';
