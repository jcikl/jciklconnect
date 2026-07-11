import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Modal, Button } from '../../ui/Common';
import { Input, Textarea, Select, Checkbox } from '../../ui/Form';
import { SurveyQuestion } from '../../../services/surveysService';

interface QuestionEditorModalProps {
    question: SurveyQuestion;
    onSave: (question: SurveyQuestion) => void;
    onClose: () => void;
    drawerOnMobile?: boolean;
}

export const QuestionEditorModal: React.FC<QuestionEditorModalProps> = ({ question, onSave, onClose, drawerOnMobile }) => {
    const [questionText, setQuestionText] = useState(question.question);
    const [questionType, setQuestionType] = useState<SurveyQuestion['type']>(question.type);
    const [required, setRequired] = useState(question.required);
    const [options, setOptions] = useState<string[]>(question.options || ['Option 1', 'Option 2']);
    const [placeholder, setPlaceholder] = useState(question.placeholder || '');
    const [helpText, setHelpText] = useState(question.helpText || '');
    const [min, setMin] = useState(question.min?.toString() || '');
    const [max, setMax] = useState(question.max?.toString() || '');
    const [step, setStep] = useState(question.step?.toString() || '1');
    const [matrixRows, setMatrixRows] = useState<string[]>(question.matrixRows || ['Row 1', 'Row 2']);
    const [matrixColumns, setMatrixColumns] = useState<string[]>(question.matrixColumns || ['Column 1', 'Column 2']);
    const [conditionalLogic, setConditionalLogic] = useState(question.conditionalLogic);
    const [enableConditional, setEnableConditional] = useState(!!question.conditionalLogic);

    const handleSave = () => {
        if (!questionText.trim()) {
            return;
        }

        const savedQuestion: SurveyQuestion = {
            ...question,
            question: questionText,
            type: questionType,
            required,
            placeholder: placeholder || undefined,
            helpText: helpText || undefined,
            min: min ? parseFloat(min) : undefined,
            max: max ? parseFloat(max) : undefined,
            step: step ? parseFloat(step) : undefined,
            options: (questionType === 'multiple-choice' || questionType === 'ranking') ? options : undefined,
            matrixRows: questionType === 'matrix' ? matrixRows : undefined,
            matrixColumns: questionType === 'matrix' ? matrixColumns : undefined,
            conditionalLogic: enableConditional && conditionalLogic ? conditionalLogic : undefined,
        };

        onSave(savedQuestion);
    };

    const handleAddOption = () => {
        setOptions([...options, `Option ${options.length + 1}`]);
    };

    const handleRemoveOption = (index: number) => {
        if (options.length > 2) {
            setOptions(options.filter((_, i) => i !== index));
        }
    };

    const handleOptionChange = (index: number, value: string) => {
        const newOptions = [...options];
        newOptions[index] = value;
        setOptions(newOptions);
    };

    return (
        <Modal isOpen={true} onClose={onClose} title="Edit Question" size="lg" drawerOnMobile={drawerOnMobile}>
            <div className="space-y-4">
                <Input
                    label="Question Text"
                    value={questionText}
                    onChange={(e) => setQuestionText(e.target.value)}
                    placeholder="Enter your question..."
                    required
                />

                <Select
                    label="Question Type"
                    value={questionType}
                    onChange={(e) => {
                        setQuestionType(e.target.value as SurveyQuestion['type']);
                        if (e.target.value !== 'multiple-choice' && e.target.value !== 'ranking') {
                            setOptions(['Option 1', 'Option 2']);
                        }
                    }}
                    options={[
                        { label: 'Text', value: 'text' },
                        { label: 'Multiple Choice', value: 'multiple-choice' },
                        { label: 'Rating (1-5)', value: 'rating' },
                        { label: 'Yes/No', value: 'yes-no' },
                        { label: 'Date', value: 'date' },
                        { label: 'Number', value: 'number' },
                        { label: 'Email', value: 'email' },
                        { label: 'Phone', value: 'phone' },
                        { label: 'Matrix', value: 'matrix' },
                        { label: 'Ranking', value: 'ranking' },
                    ]}
                />

                {(questionType === 'text' || questionType === 'number' || questionType === 'email' || questionType === 'phone') && (
                    <Input
                        label="Placeholder Text"
                        value={placeholder}
                        onChange={(e) => setPlaceholder(e.target.value)}
                        placeholder="e.g. Enter your answer..."
                    />
                )}

                {questionType === 'number' && (
                    <div className="grid grid-cols-3 gap-4">
                        <Input
                            label="Min Value"
                            type="number"
                            value={min}
                            onChange={(e) => setMin(e.target.value)}
                            placeholder="Min"
                        />
                        <Input
                            label="Max Value"
                            type="number"
                            value={max}
                            onChange={(e) => setMax(e.target.value)}
                            placeholder="Max"
                        />
                        <Input
                            label="Step"
                            type="number"
                            value={step}
                            onChange={(e) => setStep(e.target.value)}
                            placeholder="1"
                        />
                    </div>
                )}

                {questionType === 'rating' && (
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Min Rating"
                            type="number"
                            value={min || '1'}
                            onChange={(e) => setMin(e.target.value)}
                            placeholder="1"
                        />
                        <Input
                            label="Max Rating"
                            type="number"
                            value={max || '5'}
                            onChange={(e) => setMax(e.target.value)}
                            placeholder="5"
                        />
                    </div>
                )}

                {(questionType === 'multiple-choice' || questionType === 'ranking') && (
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-700">Options</label>
                        {options.map((option, index) => (
                            <div key={index} className="flex gap-2">
                                <Input
                                    value={option}
                                    onChange={(e) => handleOptionChange(index, e.target.value)}
                                    placeholder={`Option ${index + 1}`}
                                />
                                {options.length > 2 && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleRemoveOption(index)}
                                        className="text-red-500"
                                    >
                                        <Trash2 size={14} />
                                    </Button>
                                )}
                            </div>
                        ))}
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleAddOption}
                        >
                            <Plus size={14} className="mr-2" />
                            Add Option
                        </Button>
                    </div>
                )}

                {questionType === 'matrix' && (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-slate-700">Matrix Rows</label>
                            {matrixRows.map((row, index) => (
                                <div key={index} className="flex gap-2">
                                    <Input
                                        value={row}
                                        onChange={(e) => {
                                            const newRows = [...matrixRows];
                                            newRows[index] = e.target.value;
                                            setMatrixRows(newRows);
                                        }}
                                        placeholder={`Row ${index + 1}`}
                                    />
                                    {matrixRows.length > 1 && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setMatrixRows(matrixRows.filter((_, i) => i !== index))}
                                            className="text-red-500"
                                        >
                                            <Trash2 size={14} />
                                        </Button>
                                    )}
                                </div>
                            ))}
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setMatrixRows([...matrixRows, `Row ${matrixRows.length + 1}`])}
                            >
                                <Plus size={14} className="mr-2" />
                                Add Row
                            </Button>
                        </div>
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-slate-700">Matrix Columns</label>
                            {matrixColumns.map((col, index) => (
                                <div key={index} className="flex gap-2">
                                    <Input
                                        value={col}
                                        onChange={(e) => {
                                            const newCols = [...matrixColumns];
                                            newCols[index] = e.target.value;
                                            setMatrixColumns(newCols);
                                        }}
                                        placeholder={`Column ${index + 1}`}
                                    />
                                    {matrixColumns.length > 1 && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setMatrixColumns(matrixColumns.filter((_, i) => i !== index))}
                                            className="text-red-500"
                                        >
                                            <Trash2 size={14} />
                                        </Button>
                                    )}
                                </div>
                            ))}
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setMatrixColumns([...matrixColumns, `Column ${matrixColumns.length + 1}`])}
                            >
                                <Plus size={14} className="mr-2" />
                                Add Column
                            </Button>
                        </div>
                    </div>
                )}

                <Textarea
                    label="Help Text (Optional)"
                    value={helpText}
                    onChange={(e) => setHelpText(e.target.value)}
                    placeholder="Additional guidance for respondents..."
                    rows={2}
                />

                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <Checkbox
                            checked={required}
                            onChange={(e) => setRequired(e.target.checked)}
                        />
                        <label className="text-sm font-medium text-slate-700">Required question</label>
                    </div>

                    <div className="border-t pt-3">
                        <div className="flex items-center gap-2 mb-3">
                            <Checkbox
                                checked={enableConditional}
                                onChange={(e) => setEnableConditional(e.target.checked)}
                            />
                            <label className="text-sm font-medium text-slate-700">Show this question conditionally</label>
                        </div>
                        {enableConditional && (
                            <div className="pl-6 space-y-3 bg-slate-50 p-3 rounded-lg">
                                <Select
                                    label="Show if previous question"
                                    value={conditionalLogic?.showIf.questionId || ''}
                                    onChange={(e) => {
                                        setConditionalLogic({
                                            showIf: {
                                                questionId: e.target.value,
                                                operator: conditionalLogic?.showIf.operator || 'equals',
                                                value: conditionalLogic?.showIf.value || '',
                                            },
                                        });
                                    }}
                                    options={[]} // Would be populated with previous question IDs
                                />
                                <Select
                                    label="Operator"
                                    value={conditionalLogic?.showIf.operator || 'equals'}
                                    onChange={(e) => {
                                        if (conditionalLogic) {
                                            setConditionalLogic({
                                                ...conditionalLogic,
                                                showIf: {
                                                    ...conditionalLogic.showIf,
                                                    operator: e.target.value as any,
                                                },
                                            });
                                        }
                                    }}
                                    options={[
                                        { label: 'Equals', value: 'equals' },
                                        { label: 'Not Equals', value: 'not_equals' },
                                        { label: 'Contains', value: 'contains' },
                                        { label: 'Is Empty', value: 'is_empty' },
                                        { label: 'Is Not Empty', value: 'is_not_empty' },
                                    ]}
                                />
                                {conditionalLogic?.showIf.operator !== 'is_empty' && conditionalLogic?.showIf.operator !== 'is_not_empty' && (
                                    <Input
                                        label="Value"
                                        value={conditionalLogic?.showIf.value || ''}
                                        onChange={(e) => {
                                            if (conditionalLogic) {
                                                setConditionalLogic({
                                                    ...conditionalLogic,
                                                    showIf: {
                                                        ...conditionalLogic.showIf,
                                                        value: e.target.value,
                                                    },
                                                });
                                            }
                                        }}
                                        placeholder="Value to compare..."
                                    />
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex gap-3 pt-4 border-t">
                    <Button onClick={handleSave} className="flex-1" disabled={!questionText.trim()}>
                        Save Question
                    </Button>
                    <Button variant="ghost" onClick={onClose}>
                        Cancel
                    </Button>
                </div>
            </div>
        </Modal>
    );
};
