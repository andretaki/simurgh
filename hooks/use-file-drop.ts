import { useCallback, useState, useRef } from "react";

export interface UseFileDropOptions {
  accept?: string[];
  multiple?: boolean;
  maxFiles?: number;
  maxSize?: number; // in bytes
  onFilesAdded?: (files: File[]) => void;
  onError?: (error: string) => void;
  validateFile?: (file: File) => string | null; // Return error message or null if valid
}

export interface UseFileDropReturn {
  isDragging: boolean;
  dragProps: {
    onDragOver: (e: React.DragEvent<HTMLElement>) => void;
    onDragLeave: (e: React.DragEvent<HTMLElement>) => void;
    onDrop: (e: React.DragEvent<HTMLElement>) => void;
  };
  inputProps: {
    type: "file";
    accept: string;
    multiple: boolean;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  };
  openFilePicker: () => void;
}

export function useFileDrop(options: UseFileDropOptions = {}): UseFileDropReturn {
  const {
    accept = ["application/pdf"],
    multiple = true,
    maxFiles,
    maxSize,
    onFilesAdded,
    onError,
    validateFile,
  } = options;

  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const validateFiles = useCallback(
    (files: File[]): { valid: File[]; errors: string[] } => {
      const valid: File[] = [];
      const errors: string[] = [];

      for (const file of files) {
        // Check file type
        if (accept.length > 0 && !accept.includes(file.type)) {
          errors.push(`${file.name}: Invalid file type. Expected ${accept.join(", ")}`);
          continue;
        }

        // Check file size
        if (maxSize && file.size > maxSize) {
          const maxSizeMB = Math.round(maxSize / 1024 / 1024);
          errors.push(`${file.name}: File too large. Max size is ${maxSizeMB}MB`);
          continue;
        }

        // Custom validation
        if (validateFile) {
          const customError = validateFile(file);
          if (customError) {
            errors.push(`${file.name}: ${customError}`);
            continue;
          }
        }

        valid.push(file);
      }

      // Check max files limit
      if (maxFiles && valid.length > maxFiles) {
        errors.push(`Too many files. Maximum allowed: ${maxFiles}`);
        valid.splice(maxFiles);
      }

      return { valid, errors };
    },
    [accept, maxSize, maxFiles, validateFile]
  );

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;

      const files = Array.from(fileList);
      const { valid, errors } = validateFiles(files);

      if (errors.length > 0 && onError) {
        onError(errors.join(". "));
      }

      if (valid.length > 0 && onFilesAdded) {
        onFilesAdded(valid);
      }
    },
    [validateFiles, onFilesAdded, onError]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFiles(e.target.files);
      // Reset the input so the same file can be selected again
      e.target.value = "";
    },
    [handleFiles]
  );

  const openFilePicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  // Create a hidden input element if it doesn't exist
  if (typeof window !== "undefined" && !inputRef.current) {
    inputRef.current = document.createElement("input");
    inputRef.current.type = "file";
    inputRef.current.accept = accept.join(",");
    inputRef.current.multiple = multiple;
    inputRef.current.style.display = "none";
    inputRef.current.addEventListener("change", (e) => {
      handleFiles((e.target as HTMLInputElement).files);
      (e.target as HTMLInputElement).value = "";
    });
    document.body.appendChild(inputRef.current);
  }

  return {
    isDragging,
    dragProps: {
      onDragOver: handleDragOver,
      onDragLeave: handleDragLeave,
      onDrop: handleDrop,
    },
    inputProps: {
      type: "file" as const,
      accept: accept.join(","),
      multiple,
      onChange: handleInputChange,
    },
    openFilePicker,
  };
}

export default useFileDrop;
