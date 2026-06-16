'use client';

import { useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import styles from './RichTextEditor.module.css';

function ToolbarButton({ onClick, active, disabled, title, children }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            title={title}
            className={`${styles.toolBtn} ${active ? styles.toolBtnActive : ''}`}
        >
            {children}
        </button>
    );
}

export default function RichTextEditor({ value, onChange, placeholder = 'Write something…' }) {
    const fileInputRef = useRef(null);
    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit,
            Image.configure({ inline: false, allowBase64: false }),
            Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' } }),
        ],
        content: value || '',
        editorProps: {
            attributes: {
                class: styles.editor,
                'data-placeholder': placeholder,
            },
        },
        onUpdate: ({ editor }) => {
            onChange?.(editor.getHTML());
        },
    });

    useEffect(() => {
        if (!editor) return;
        const current = editor.getHTML();
        if ((value || '') !== current) {
            editor.commands.setContent(value || '', false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value, editor]);

    if (!editor) return <div className={styles.wrapper}><div className={styles.editor}>Loading…</div></div>;

    const handleAddLink = () => {
        const prev = editor.getAttributes('link').href || '';
        const url = window.prompt('URL', prev);
        if (url === null) return;
        if (url === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
            return;
        }
        editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    };

    const handleImageClick = () => {
        fileInputRef.current?.click();
    };

    const handleImageSelected = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await fetch('/api/admin/announcements/upload-image', {
                method: 'POST',
                body: formData,
            });
            if (!res.ok) {
                const t = await res.text();
                throw new Error(t || 'Upload failed');
            }
            const { url } = await res.json();
            editor.chain().focus().setImage({ src: url, alt: file.name }).run();
        } catch (err) {
            alert(`Image upload failed: ${err.message}`);
        }
    };

    return (
        <div className={styles.wrapper}>
            <div className={styles.toolbar}>
                <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold"><b>B</b></ToolbarButton>
                <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic"><i>I</i></ToolbarButton>
                <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strikethrough"><s>S</s></ToolbarButton>
                <span className={styles.divider} />
                <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading 2">H2</ToolbarButton>
                <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Heading 3">H3</ToolbarButton>
                <ToolbarButton onClick={() => editor.chain().focus().setParagraph().run()} active={editor.isActive('paragraph')} title="Paragraph">P</ToolbarButton>
                <span className={styles.divider} />
                <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bulleted list">• List</ToolbarButton>
                <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered list">1. List</ToolbarButton>
                <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Blockquote">❝</ToolbarButton>
                <ToolbarButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} title="Code block">{'<>'}</ToolbarButton>
                <span className={styles.divider} />
                <ToolbarButton onClick={handleAddLink} active={editor.isActive('link')} title="Link">🔗</ToolbarButton>
                <ToolbarButton onClick={handleImageClick} title="Insert image">🖼️</ToolbarButton>
                <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Divider">―</ToolbarButton>
                <span className={styles.divider} />
                <ToolbarButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo">↶</ToolbarButton>
                <ToolbarButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo">↷</ToolbarButton>
            </div>
            <EditorContent editor={editor} />
            <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                style={{ display: 'none' }}
                onChange={handleImageSelected}
            />
        </div>
    );
}
